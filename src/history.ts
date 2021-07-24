'use strict';

import * as fsSync from 'fs';

import Markov from 'markovchain';
import { S3 } from './aws';
import stream, { Stream } from 'stream';
import StreamZip from 'node-stream-zip';
import _ from 'lodash';
import { debuglog } from 'util';
import { promises as fs } from 'fs';
import { includeUser } from './user-filter-conditions';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import wu from 'wu';
import zlib from 'zlib';

const debug = debuglog('deadtous:history');

const brotliCompress = promisify(zlib.brotliCompress)
const brotliDecompress = promisify(zlib.brotliDecompress)

abstract class Fs {

    _maxCacheSize: number
    _cacheSize: number
    _cache: Array<any>

    constructor(cacheSize=50 * 1024 * 1024) {
        this._maxCacheSize = cacheSize
        this._cacheSize = 0
        this._cache = []
    }

    abstract _read(key): Promise<any>;

    abstract _write(fileData, key): Promise<void>;

    _joinPath(...pathComponents) {
        throw new Error('Not implemented')
    }

    _writeCache(key, data, size) {
        // TODO why does this need a size?
        if (size < this._maxCacheSize) {
            let newItem = { key, data, size }
            let itemSizes = 0
            for (let i = this._cache.length - 1; i >= 0; i--) {
                let item = this._cache[i]
                itemSizes += item.size
                if (itemSizes >= size) {
                    // Deletes items after this position
                    this._cache.splice(i)
                    this._cache.splice(0, 0, newItem)
                    return
                }
            }
        }        
    }

    async read(...pathComponents) {
        let item
        let key = this._joinPath(...pathComponents)
        for (let i = 0; i < this._cache.length; i++) {
            item = this._cache[i]
            if (item.key == key) {
                if (i > 0) {
                    // MRU, move to head of list
                    this._cache.splice(i, 1)
                    this._cache.splice(0, 0, item)
                }
                return item.data
            }
        }
        // If cache miss
        let dataBin = await this._read(key)
        let dataJson = (await brotliDecompress(dataBin)).toString()
        let data = JSON.parse(dataJson)
        this._writeCache(key, data, dataJson.length)
        return data
    }

    async write(data, ...pathComponents) {
        let key = this._joinPath(...pathComponents)
        debug(`write to key`)
        let dataJson = JSON.stringify(data)
        // Remove existing matching item from cache
        for (let i = 0; i < this._cache.length; i++) {
            if (this._cache[i].key == key) {
                this._cache.splice(i, 1)
                break
            }
        }
        this._writeCache(key, data, dataJson.length)
        await this._write(await brotliCompress(dataJson), key)
    }

}

class LocalFs extends Fs {
    private _base: string;

    constructor(basePath) {
        super()
        this._base = basePath
    }

    _joinPath(...pathComponents) {
        return path.join(...pathComponents)
    }

    async _read(key) {
        return await fs.readFile(path.join(this._base, key))
    }

    async _write(fileData, key) {
        debug(`write local file ${key}`)
        await fs.writeFile(path.join(this._base, key), fileData)
    }

}

class S3Fs extends Fs {

    _inProgress: number
    private _bucket: string;
    private _basePath: string;
    private _concurrencyLimit: number;
    private _waiters: Function[];
    private _s3: S3;

    constructor(basePath, concurrencyLimit=4) {
        super()

        // First path component is taken to be bucket name
        let basePathComponents = basePath.split('/')
        this._bucket = basePathComponents.shift()
        this._basePath = basePathComponents.join('/')

        this._concurrencyLimit = concurrencyLimit
        this._inProgress = 0
        this._waiters = []

        this._s3 = new S3(this._bucket)
    }

    _joinPath(...pathComponents) {
        return pathComponents.join('/')
    }

    /**
     * Run `func` with a global concurrency limit shared with other callers to `_limit`.
     * A bit like Python's asyncio.Semaphore.
     * @param {function} func 
     */
    async _limit(func) {
        if (this._inProgress > this._concurrencyLimit) {
            // Wait to be told to proceed
            await new Promise(resolve => this._waiters.push(resolve))
        }
        this._inProgress += 1
        try {
            return await func()
        } finally {
            this._inProgress = Math.max(this._inProgress - 1, 0)
            let waiter = this._waiters.shift()
            if (waiter)
                waiter()            
        }
    }

    async _read(...pathComponents) {
        return await this._limit(async () => {
            let key = pathComponents.join('/')
            return await this._s3.getObject(key)
        })
    }

    async _write(fileData, ...pathComponents) {
        await this._limit(async () => {
            let key = pathComponents.join('/')
            await this._s3.putObject(key, fileData)
        });
    }

}

// @ts-ignore: duplicate-identifier
export class History {

    public fs: Fs
    _users

    /**
     * 
     * @param {*} location Directory where history is/should be stored.
     * @param {*} locationType 's3' or 'local'
     */
    constructor(location, locationType='local') {
        if (locationType == 'local') {
            this.fs = new LocalFs(location)
        } else if (locationType == 's3') {
            this.fs = new S3Fs(location)
        } else {
            throw new Error(`${locationType} is not a known filesystem type`)
        }
    }

    /**
     * Return list of users. Each user will contain, at minimum, `id` and `name`.
     * Note, only "dead" users are saved.
     */
    async getUsers() {
        if (!this._users) {
            this._users = await this.fs.read('users')
        }
        return this._users || []
    }

    /**
     * Return user for id/username or undefined
     * @param {} id 
     */
    async getUser(idOrUsername) {
        let users = await this.getUsers()
        for (let user of wu(users).filter(u => u.id == idOrUsername))
            return user;
        for (let user of wu(users).filter(u => u.name == idOrUsername))
            return user;
    }

    async import(slackExportZip) {

        //  1. Extract zip
        //  2. For each file read:
        //      a. If messages, and users/channels already read: save "dead" users messages to own file.
        //      b. If messages, and users/channels not read: save to temp file.
        //      c. If users/channels parse, and if both read process temp message files.
        //  3. For each user corpus, build markov.

        debug('import')

        const reMessagesFile = /^.[^\/]+\/\d{4}-\d{2}-\d{2}\.json$/     

        let tmpDir = await fs.mkdtemp(os.tmpdir() + path.sep)
        const CORPUS_DIR = path.join(tmpDir, 'corpuses')
        await fs.mkdir(CORPUS_DIR)
        await fs.mkdir(path.join(tmpDir, 'messages'))

        let users, channels = []
        let self = this
        
        try {
            await new Promise(async (resolve, reject) => {
                const zipFile = new StreamZip({
                    file: slackExportZip,
                    storeEntries: false
                })

                async function entryAsStream(zipEntry): Promise<stream.Readable> {
                    return await new Promise((resolve, reject) => {
                        zipFile.stream(zipEntry, (err, stream) => {
                            if (err || !stream) {
                                reject(err)
                            } else {
                                // @ts-ignore
                                resolve(stream)
                            }
                        })
                    })
                }

                async function entryAsJson(zipEntry: StreamZip.ZipEntry) {
                    let stream = await entryAsStream(zipEntry)
                    const chunks: Array<Buffer> = []
                    let stringData: string = await new Promise((resolve, reject) => {
                        stream.on('data', chunk => chunks.push(chunk))
                        stream.on('error', reject)
                        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
                    })
                    return JSON.parse(stringData)
                }

                function filterMessage(msg) {
                    return !msg || 
                        msg.includes('has joined the channel') ||
                        msg.includes('has left the channel');
                }
            
                /**
                 * 
                 * @param {string} msg 
                 */
                async function rewriteMessage(msg) {

                    function getUserName(id) {
                        for (let user of wu(users).filter(u => u.id == id))
                            return user.name
                        return id
                    }
        
                    function getChannelName(id) {
                        for (let channel of wu(channels).filter(c => c.id == id))
                            return channel.name
                        return id
                    }
        
                    var rewritten = msg
                        //Strip uploaded files without comments
                        .replace(/^<@.+> uploaded a file: <.+>$/, '')
                        //Replace references to users with their handles
                        .replace(/<@(\w+)>/g, (match, userId) => '@' + getUserName(userId))
                        //Strip uploaded files to comments only
                        .replace(/^<@.+> uploaded a file: <.+> and commented: /, '')
                        //Strip links
                        .replace(/<[a-z0-9]+\:.+>/g, '')
                        //Strip blockquotes
                        .replace(/```[\s\S]+```/g, '')
                        //Replace channel references
                        .replace(/<!(\w+)>/g, (match, name) => '@' + name)
                        //Moar channel references
                        .replace(/<#(.+)\|.+>/g, (match, id) => '#' + getChannelName(id))
                        //And moar
                        .replace(/<#(.+)>/g, (match, id) => '#' + getChannelName(id))
                        //Strip anything JSONy
                        .replace(/\{[\s\S]+\}/g, '')
                        //Remove quoted text
                        .replace(/^&gt;.+/g, '')
                        //Remove XMLish data
                        .replace(/&lt;[\s\S]+&gt;/g, '')
                        //Remove uuids
                        .replace(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g, '')
                        //Remove big numbers cos they're boring
                        .replace(/\d{5,}/g, '')
        
                    var nuke = 
                        // remove slash commands
                        rewritten.match(/^\/\w+/) ||
                        // remove user action messages
                        rewritten.match(/^<@.+> /)
                    if (nuke) return '';        
        
                    //End the message always with a dot if it doesn't already end with punctation
                    if (!rewritten.match(/[.!?]$/)) rewritten = rewritten + '.';
        
                    return rewritten;
                }

                async function processMessages(messages) {
                    // Save raw message text to files, one per user
                    let fd, lastUser = 0;
                    try {
                        for (let m of messages) {
                            let user = await self.getUser(m.user)
                            if (!user || filterMessage(m.text) || !includeUser(user)) 
                                continue;

                            if (lastUser != m.user) {
                                if (fd)
                                    await fd.close();
                                fd = await fs.open(path.join(CORPUS_DIR, m.user), 'a');
                                lastUser = m.user;
                            }
                            await fd.write((await rewriteMessage(m.text)) + ' ');
                        }
                    } finally {
                        if (fd) {
                            await fd.close()
                        }
                    }
                }

                let processedSavedMessages = false
                async function processSavedMessages() {
                    if (!processedSavedMessages) {
                        if (users && channels) {
                            processedSavedMessages = true
                            let readDir = path.join(tmpDir, 'messages')
                            let files = await fs.readdir(readDir)
                            for (let file of files) {
                                let filePath = path.join(readDir, file)
                                let content = await fs.readFile(filePath, { encoding: 'utf8' })
                                await processMessages(JSON.parse(content))
                                await fs.unlink(filePath)
                            }
                        }
                    }
                }

                let pendingHandlers: Promise<void>[] = []
                zipFile.on('entry', entry => {
                    pendingHandlers.push((async () => {
                        if (!entry.isDirectory) {
                            if (entry.name == 'channels.json') {
                                // File contains list of channels
                                channels = await entryAsJson(entry)
                                await processSavedMessages()
                            } else if (entry.name == 'users.json') {
                                // File contains list of users
                                this._users = users = await entryAsJson(entry)
                                await processSavedMessages()
                            } else if (reMessagesFile.exec(entry.name)) {
                                // File contains messages
                                if (!users || !channels) {
                                    // Save until we have these 
                                    let f = fsSync.createWriteStream(path.join(tmpDir, 'messages', entry.offset + '.json'))
                                    let zipStream = await entryAsStream(entry)
                                    zipStream.pipe(f)
                                } else {
                                    await processMessages(await entryAsJson(entry))
                                }
                            }
                        }
                    })())
                })

                zipFile.on('ready', () => {
                    (async () => {
                        debug('await extract handlers')
                        await Promise.all(pendingHandlers)

                        zipFile.close()

                        if (!users || !channels) {
                            reject(new Error('Zip file is missing user or channel data'))
                            return
                        }

                        // Digest to markov wordbanks
                        let files = await fs.readdir(CORPUS_DIR);

                        function* processFiles() {
                            for (let file of files) {
                                yield (async () => {
                                    let corpus = await fs.readFile(path.join(CORPUS_DIR, file), { encoding: 'utf8' })
                                    let wordBank = new Markov(corpus).wordBank
                                    await self.fs.write(wordBank, file)
                                })()
                            }
                        }
                        debug('markovStart')
                        await Promise.all(processFiles())
                        debug('markovEnd')

                        // Filter/Map/Save users
                        await self.fs.write(
                            users.filter(includeUser).map(u => ({ id: u.id, name: u.name, profile: { image_192: u.profile.image_192 }})),
                            'users'
                        )
                    })().then(resolve).catch(reject)
                })

            })
        } finally {
            // @ts-ignore
            await fs.rm(tmpDir, { recursive: true })
        }
    }

    async speak(usernameOrId) {
    
        // Try to locate user by ID. If that fails, by name.
        let user = await this.getUser(usernameOrId);
        if (!user) return
    
        let wordBank = await this.fs.read(user.id)
        if (!wordBank) return
    
        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min)) + min;
        }
    
        function getRandomStart() {
            let words = Object.keys(wordBank)
            var rand = getRandomInt(0, words.length - 1);
            return words[rand];
        }
    
        function isSentenceComplete(sentence) {
            return sentence.match(/[.!?:"]$/);
        }
    
        let markov = new Markov();
        markov.wordBank = wordBank;
    
        let post = markov.start(getRandomStart).end(isSentenceComplete).process();   
    
        return {
            text: post,
            username: user.name,
            icon_url: user.profile.image_192
        };
    }

}
