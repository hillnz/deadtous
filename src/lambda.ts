import { APIGatewayProxyEventV2, Context } from 'aws-lambda'
import { SlackServer } from './slack-server'

let slackServer: SlackServer

/** Entrypoint for hosting within an AWS Lambda */
export async function handler(event: APIGatewayProxyEventV2, context: Context) {
    let location = process.env.DEADTOUS_STORAGE || ''
    let tokens = (process.env.DEADTOUS_SLACK_TOKENS || '').split(',')
    if (!slackServer) {
        slackServer = new SlackServer(location, tokens)
    }
    return await slackServer.handleLambdaEvent(event, context)
}
