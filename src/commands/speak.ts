import {Command, flags} from '@oclif/command'
import { History } from '../history'
import * as global from '../command-globals'

export default class Speak extends Command {

    static description = 'make a dead user say something'

    static flags = {
        ...global.flags,
        list: flags.boolean({char: 'l', }),
    }

    static args = [
        {name: 'user'},
    ]

    async run() {
        const {args, flags} = this.parse(Speak)
        let history = new History(flags.storage)
        if (flags.list) {
            let users = await history.getUsers()
            let userList = users.map(u => u.name).sort().join('\n')
            this.log(userList)
            return
        }
        let utterance = await history.speak(args.user)
        if (!utterance) {
            this.error('User not found')
        }
        this.log(utterance?.text)
    }
}
