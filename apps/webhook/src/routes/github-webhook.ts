import type { FastifyInstance } from 'fastify'
import { verifySignature } from '../verify-signature.js'

const HANDLED_ACTIONS = new Set(['opened', 'synchronize'])

export async function githubWebhookRoute(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/github', async (request, reply) => {
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) {
      app.log.error('WEBHOOK_SECRET is not set')
      return reply.code(500).send()
    }

    const rawBody = request.body as Buffer
    const signature = request.headers['x-hub-signature-256']

    if (typeof signature !== 'string' || !verifySignature(rawBody, signature, secret)) {
      app.log.warn('webhook signature verification failed')
      return reply.code(401).send()
    }

    if (request.headers['x-github-event'] !== 'pull_request') {
      return reply.code(200).send()
    }

    const payload = JSON.parse(rawBody.toString('utf8'))

    if (!HANDLED_ACTIONS.has(payload.action)) {
      return reply.code(200).send()
    }

    console.log({
      repo: payload.repository.full_name,
      pr: payload.pull_request.number,
      action: payload.action,
      sha: payload.pull_request.head.sha,
    })

    return reply.code(200).send()
  })
}
