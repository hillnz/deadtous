import {Command, flags} from '@oclif/command'
import { History } from '../history'
import * as global from '../command-globals'

export default class Import extends Command {

    static description = 'import a Slack export archive file'

    static flags = {
        ...global.flags
    }

    static args = [
        {name: 'slack_export_file'}
    ]

    async run() {
        const {args, flags} = this.parse(Import)
        let history = new History(flags.storage)
        console.error('Importing Slack archive. This will take a while for large files...')
        await history.import(args.slack_export_file)
    }
}
