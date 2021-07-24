deadtous
========

# --- WIP ---

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/deadtous.svg)](https://npmjs.org/package/deadtous)
[![Downloads/week](https://img.shields.io/npm/dw/deadtous.svg)](https://npmjs.org/package/deadtous)
[![License](https://img.shields.io/npm/l/deadtous.svg)](https://github.com/jonohill/deadtous/blob/master/package.json)

<!-- toc -->
* [--- WIP ---](#----wip----)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g deadtous
$ deadtous COMMAND
running command...
$ deadtous (-v|--version|version)
deadtous/0.0.6 linux-x64 node-v14.17.3
$ deadtous --help [COMMAND]
USAGE
  $ deadtous COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`deadtous dump [KEY]`](#deadtous-dump-key)
* [`deadtous help [COMMAND]`](#deadtous-help-command)
* [`deadtous import [SLACK_EXPORT_FILE]`](#deadtous-import-slack_export_file)
* [`deadtous server`](#deadtous-server)
* [`deadtous speak [USER]`](#deadtous-speak-user)

## `deadtous dump [KEY]`

read a file from storage

```
USAGE
  $ deadtous dump [KEY]

OPTIONS
  -s, --storage=storage  (required) storage path
```

_See code: [src/commands/dump.ts](https://github.com/jonohill/deadtous/blob/v0.0.6/src/commands/dump.ts)_

## `deadtous help [COMMAND]`

display help for deadtous

```
USAGE
  $ deadtous help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

## `deadtous import [SLACK_EXPORT_FILE]`

import a Slack export archive file

```
USAGE
  $ deadtous import [SLACK_EXPORT_FILE]

OPTIONS
  -s, --storage=storage  (required) storage path
```

_See code: [src/commands/import.ts](https://github.com/jonohill/deadtous/blob/v0.0.6/src/commands/import.ts)_

## `deadtous server`

run a Slack webhook HTTP server

```
USAGE
  $ deadtous server

OPTIONS
  -s, --storage=storage  (required) storage path
  --port=port            [default: 8080]
  --tokens=tokens        (required)
```

_See code: [src/commands/server.ts](https://github.com/jonohill/deadtous/blob/v0.0.6/src/commands/server.ts)_

## `deadtous speak [USER]`

make a dead user say something

```
USAGE
  $ deadtous speak [USER]

OPTIONS
  -l, --list
  -s, --storage=storage  (required) storage path
```

_See code: [src/commands/speak.ts](https://github.com/jonohill/deadtous/blob/v0.0.6/src/commands/speak.ts)_
<!-- commandsstop -->
