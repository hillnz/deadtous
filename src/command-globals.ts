import { flags as f } from '@oclif/command'

export let flags = {
    storage: f.string({ char: 's', description: 'storage path', env: 'DEADTOUS_STORAGE', required: true }),
}
