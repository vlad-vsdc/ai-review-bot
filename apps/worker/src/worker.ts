import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Worker } from 'bullmq'
import { PR_REVIEW_QUEUE_NAME, redisConnection, initDb, type PrReviewJobData } from '@ai-review-bot/core'
import { processPrReviewJob } from './jobs/process-pr.js'

const DEFAULT_DB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../data/reviews.db')

export function buildWorker() {
  initDb(process.env.REVIEWS_DB_PATH ?? DEFAULT_DB_PATH)

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

// stats seed trigger
