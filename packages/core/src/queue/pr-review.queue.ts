import { Queue } from 'bullmq'
import { redisConnection } from './connection.js'

export const PR_REVIEW_QUEUE_NAME = 'pr-review'

export interface PrReviewJobData {
  installationId: number
  repoFullName: string
  prNumber: number
  headSha: string
}

export const prReviewQueue = new Queue<PrReviewJobData>(PR_REVIEW_QUEUE_NAME, {
  connection: redisConnection,
})
