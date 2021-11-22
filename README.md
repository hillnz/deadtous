deadtous
========

It can be hard moving on from those who leave your Slack organisation. How about a #deadtous channel where you can still talk to the departed?

## What it does

Once you deploy deadtous, configure Slack and provide an export of your Slack history, it'll take on the personalities of those who have left.
You'll be able to mention them directly by name in the channel of your choice and they'll respond!

You can:
- Type `/deadtous` to see a list of who are the departed.
- Type any message and mention one of these users to see them reply, e.g. `@john.smith we miss you!`

## How it works

- You configure a Slack slash command and webhook so that deadtous can receive Slack messages from the channel you've chosen.
- You deploy deadtous somewhere it can receive webhooks from Slack (e.g. with a container, or in AWS using the Terraform module).
- It takes your Slack history and filters down to deleted users' messages. Then those get run through a Markov engine.
- When it receives a message, it checks for @mentions of deleted users. If it finds one, it uses the Markov data to generate a random message and responds, along with the deleted user's name and profile image.

## Get started

You will need to deploy deadtous somewhere it can receive an HTTP request from Slack. The [Deploy](#deploy) section lists some ways that you can do this.

Choose how you'll deploy, then:
1. Create an [Outgoing Webhook](https://my.slack.com/apps/A0F7VRG6Q-outgoing-webhooks?tab=more_info). Configure a channel so that only these messages get sent. Leave everything else as is for now and keep the page open. 
2. Create a [Slash Command](https://my.slack.com/apps/A0F82E8CA-slash-commands?tab=more_info). Set the command to `/deadtous` (or something else if you prefer). You can set a custom icon and description if you like, but leave everything else as is for now, and keep the page open.
3. Deploy, per your chosen option. You need to supply the Slack tokens - take these from the pages above, separated by a comma.
4. Set the URL in the above pages. This URL must be public, as Slack will call this when a message is sent. If you used the Terraform deployment option, the URL will be printed on apply.

Now you can supply your Slack export.
1. [Export your Slack data](https://my.slack.com/services/export). If you have permission for private messages export, don't include these, otherwise the generated messages may include private content.
2. Run deadtous directly to create the message digests. You can do that with `npx deadtous import`, or with `docker run --rm jonoh/deadtous import`. See [full CLI usage below](#deadtous-import-slack_export_file).
3. If necessary, copy the message digests to the server's storage location.

Example: run directly with S3 output.
```
npx deadtous import -s s3:/my-bucket my-slack-export.zip
```
Example: run in Docker with local output.
```
docker run -it --rm -v /host/path:/data deadtous import my-slack-export.zip
```

Finally, you're done. Try mentioning a deleted user in your configured channel.

## Deploy

This section lists a few different ways you could deploy deadtous to a server.
In all cases it requires somewhere to store data, a local filesystem or S3 are supported.
To use S3, set the storage path in the format `s3:/bucket-name`, otherwise the path will be interpreted as local.

<details>
  <summary>Show deployment options</summary>

### Run directly

If you have a server with Node you can deploy and run it directly.
[Clone the project](https://github.com/hillnz/deadtous), install the dependendies and then run `bin/run server`, or just run `npx deadtous server` (see [`deadtous server`](#deadtous-server) for usage).

Your server must be able to receive public HTTP requests so that Slack can send its webhook request.

### AWS Lambda

Lambda is very cheap, and convenient if you already have an AWS account.

A [Terraform module](https://registry.terraform.io/modules/jonohill/deadtous/aws/latest) is available to make deployment easier. You should be able to use [the example](https://github.com/jonohill/terraform-aws-deadtous/blob/main/examples/basic/main.tf) without modification by running `terraform apply`.

If you have your own way to deploy Lambdas, you can use the [Docker image that includes the Lambda runtime](https://hub.docker.com/r/jonoh/deadtous/tags?page=1&ordering=last_updated&name=lambda) (the Lambda builds are tagged with a `-lambda` suffix).

### Docker Image

The image is [published on  Docker hub](https://hub.docker.com/r/jonoh/deadtous).
Run it as you would any other image, e.g. `docker run`, `docker-compose`, Kubernetes, etc. Your container must be able to receive public HTTP requests so that Slack can send its webhook request.

### Environment variables

Name | Default | Purpose
---  | ---     | ---
DEADTOUS_STORAGE | `/data` | Data storage location (local fs or s3)
DEADTOUS_SLACK_TOKENS | None | Slack webhook/slash tokens (Required)
DEADTOUS_PORT | 80 | Listening port

### Ports

Default | Purpose
---     | ---
80      | Listening port for Slack

### Volumes

Default Path | Purpose
---  | ---
`/data` | Storage location (set with `DEADTOUS_STORAGE`)

### Example

Running with `docker run`, listening on port 8080:
```
docker run \
  -e DEADTOUS_SLACK_TOKENS=${SECRET_TOKENS} \
  -p 8080:80 \
  -v /host/path/to/data:/data \
  jonoh/deadtous
```



</details>

# CLI Usage

You can run the CLI with `npx deadtous` or `docker run -it --rm jonoh/deadtous`.

<details>
  <summary>Show detailed usage</summary>

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

_See code: [src/commands/dump.ts](https://github.com/jonohill/deadtous/blob/v1.0.3/src/commands/dump.ts)_

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

_See code: [src/commands/import.ts](https://github.com/jonohill/deadtous/blob/v1.0.3/src/commands/import.ts)_

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

_See code: [src/commands/server.ts](https://github.com/jonohill/deadtous/blob/v1.0.3/src/commands/server.ts)_

## `deadtous speak [USER]`

make a dead user say something

```
USAGE
  $ deadtous speak [USER]

OPTIONS
  -l, --list
  -s, --storage=storage  (required) storage path
```

_See code: [src/commands/speak.ts](https://github.com/jonohill/deadtous/blob/v1.0.3/src/commands/speak.ts)_
<!-- commandsstop -->

</details>
