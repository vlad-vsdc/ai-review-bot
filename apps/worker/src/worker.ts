import 'dotenv/config'
import { Worker } from 'bullmq'
import { PR_REVIEW_QUEUE_NAME, redisConnection, type PrReviewJobData } from '@ai-review-bot/core'
import { processPrReviewJob } from './jobs/process-pr.js'

export function buildWorker() {
  const worker = new Worker<PrReviewJobData>(
    PR_REVIEW_QUEUE_NAME,
    (job) => processPrReviewJob(job.data),
    { connection: redisConnection, concurrency: 2 }
  )
  worker.on('failed', (job, err) => {
    console.error({ jobId: job?.id, err: err.message })
  })
  return worker
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildWorker()
}
