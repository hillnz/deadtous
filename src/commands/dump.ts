import {Command, flags} from '@oclif/command'
import { History } from '../history'
import * as global from '../command-globals'
import { createServer } from 'http'

export default class Server extends Command {

    static description = 'read a file from storage'

    static flags = {
        ...global.flags
    }

    static args = [
        {name: 'key'},
    ]

    async run() {
        const {args, flags} = this.parse(Server)
        let history = new History(flags.storage)
        let data = await history.fs.read(args.key)
        this.log(JSON.stringify(data, null, '  '))
    }
}
