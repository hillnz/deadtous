
import * as serverless from 'serverless-http'
import * as express from 'express'
import { History } from './history'
import { Request, Response, Express } from 'express'
import * as Lambda from 'aws-lambda'

export class SlackServer {

    public port

    private _app: Express

    constructor(location: string, tokens: string[], port = 80) {
        if (!tokens) {
            throw Error('tokens must be set')
        }

        this.port = port

        let history = new History(location)

        let app = this._app = express.default()
        app.use(express.urlencoded())

        app.use((req, resp, next) => {
            if (tokens.includes(req.body.token)) {
                next()
            } else {
                resp.status(403).send()
            }
        })

        /** Wrapper for async express handler */
        function asyncHandler(f: (req: Request, resp: Response, next) => Promise<void>) {
            return function(req: Request, res: Response, next) {
                f(req, res, next).catch(next)
            }
        }
        
        /** Rewrite based on body, either slash command or webhook */
        app.post('/', asyncHandler(async (req, _res, next) => {
            let body = req.body
            if (body.command) {
                req.url = '/who'
            } else if (body.text) {
                req.url = '/speak'
            }
            next()
        }))

        app.post('/who', asyncHandler(async (_req, res) => {
            let users = await history.getUsers()
            let responseMessage = 'The departed: ' + users.map(u => u.name).sort().reduce((prev, next) => prev + ', ' + next)
            res.send(responseMessage)
        }))
        
        app.post('/speak', asyncHandler(async (req, res) => {
            let text: string = req.body.text || '';
            res.status(200)

            // Check if there's a username in the message
            let match: RegExpMatchArray | null;
            if (match = text.match(/@([a-z0-9][a-z0-9._-]*)/)) {
                let userId = match[1];
                console.error('Extracted userId ' + userId);

                let post = await history.speak(userId);
                // TODO friendly message if the user was not found
                if (post) {
                    res.send(post)
                    return
                }
            }
            res.send()
        }))

        app.use((_req, res) => res.status(404).send())
    }

    listen() {
        this._app.listen(this.port)
    }

    async handleLambdaEvent(event: Lambda.APIGatewayProxyEventV2, context: Lambda.Context) {
        return await serverless.default(this._app)(event, context)
    }
}
