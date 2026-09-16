import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Fastify from 'fastify'
import { initDb } from '@ai-review-bot/core'
import { githubWebhookRoute } from './routes/github-webhook.js'
import { statsRoute } from './routes/stats.js'

const PORT = Number(process.env.PORT) || 3000
// Same physical file as apps/worker's default (packages/core/src/db writes there) —
// webhook only reads it, the worker is the sole writer.
const DEFAULT_DB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../worker/data/reviews.db')

export function buildServer() {
  const app = Fastify({ logger: true })

  // GitHub's HMAC signature must be verified against the raw request body,
  // so the JSON content type is parsed into a Buffer instead of being
  // auto-parsed into an object before the route can check it.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.register(githubWebhookRoute)
  app.register(statsRoute)

  return app
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initDb(process.env.REVIEWS_DB_PATH ?? DEFAULT_DB_PATH)

  const app = buildServer()

  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
}
