import type { FastifyInstance } from 'fastify'
import { prReviewQueue, redisConnection } from '@ai-review-bot/core'
import { verifySignature } from '../verify-signature.js'
import { shouldThrottle } from '../throttle.js'

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

    const installationId = payload.installation.id
    const repoFullName = payload.repository.full_name
    const prNumber = payload.pull_request.number
    const headSha = payload.pull_request.head.sha

    const throttleMinutes = Number(process.env.REVIEW_THROTTLE_MINUTES) || 5

    if (await shouldThrottle(redisConnection, repoFullName, prNumber, throttleMinutes)) {
      app.log.info({ repo: repoFullName, pr: prNumber }, 'review throttled')
      return reply.code(200).send()
    }

    await prReviewQueue.add('review', { installationId, repoFullName, prNumber, headSha })

    return reply.code(200).send()
  })
}
