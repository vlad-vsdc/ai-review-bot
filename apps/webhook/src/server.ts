import 'dotenv/config'
import Fastify from 'fastify'
import { githubWebhookRoute } from './routes/github-webhook.js'

const PORT = Number(process.env.PORT) || 3000

export function buildServer() {
  const app = Fastify({ logger: true })

  // GitHub's HMAC signature must be verified against the raw request body,
  // so the JSON content type is parsed into a Buffer instead of being
  // auto-parsed into an object before the route can check it.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.register(githubWebhookRoute)

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildServer()

  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
}
