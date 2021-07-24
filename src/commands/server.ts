import {Command, flags} from '@oclif/command'
import * as global from '../command-globals'
import { SlackServer } from '../slack-server'

export default class Server extends Command {

    static description = 'run a Slack webhook HTTP server'

    static flags = {
        ...global.flags,
        port: flags.integer({default: 8080}),
        tokens: flags.string({
            required: true,
            env: 'DEADTOUS_SLACK_TOKENS'
        })
    }

    static args = []

    async run() {
        const {flags} = this.parse(Server)
        const tokens = flags.tokens.split(',')
        let server = new SlackServer(flags.storage, tokens, flags.port)
        console.error(`Listening on port ${flags.port}... (Ctrl-C to stop)`)
        server.listen()
    }
}
