import type { FastifyInstance } from 'fastify'
import { getStats } from '@ai-review-bot/core'

export async function statsRoute(app: FastifyInstance): Promise<void> {
  app.get('/stats', async () => getStats())
}
