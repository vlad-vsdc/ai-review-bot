import pLimit from 'p-limit'
import type { Issue, PrReviewJobData } from '@ai-review-bot/core'
import { fetchPrDiff } from '../pipeline/fetch-diff.js'
import { ClaudeProvider } from '../pipeline/review-provider/claude-provider.js'
import { GroqProvider } from '../pipeline/review-provider/groq-provider.js'
import { FallbackReviewProvider } from '../pipeline/review-provider/fallback-provider.js'

const MAX_CONCURRENT_REVIEWS = 3

export interface SkippedFile {
  file: string
  reason: string
}

export interface PrReviewOutcome {
  issues: Issue[]
  reviewedFiles: number
  skippedFiles: SkippedFile[]
}

function detectLanguage(filename: string): string {
  if (filename.endsWith('.py')) return 'python'
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript'
  return 'javascript'
}

export async function processPrReviewJob(data: PrReviewJobData): Promise<PrReviewOutcome> {
  const [owner, repo] = data.repoFullName.split('/')

  const diffFiles = await fetchPrDiff({
    appId: process.env.GITHUB_APP_ID!,
    privateKeyPath: process.env.GITHUB_PRIVATE_KEY_PATH!,
    installationId: data.installationId,
    owner,
    repo,
    prNumber: data.prNumber,
  })

  const reviewableFiles = diffFiles.filter((file) => file.status === 'ok')

  const limit = pLimit(MAX_CONCURRENT_REVIEWS)
  const provider = new FallbackReviewProvider(
    new ClaudeProvider(process.env.CLAUDE_API_KEY!),
    new GroqProvider(process.env.GROQ_API_KEY!)
  )

  const settled = await Promise.allSettled(
    reviewableFiles.map((file) =>
      limit(async () => {
        const language = detectLanguage(file.filename)
        const result = await provider.review(file.patch!, language)
        return result.issues.map((issue) => ({ ...issue, file: file.filename }))
      })
    )
  )

  const issues: Issue[] = []
  const skippedFiles: SkippedFile[] = []

  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      issues.push(...outcome.value)
      return
    }

    const file = reviewableFiles[i].filename
    const error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
    console.warn({ file, error })
    skippedFiles.push({ file, reason: 'review failed' })
  })

  const result: PrReviewOutcome = {
    issues,
    reviewedFiles: reviewableFiles.length - skippedFiles.length,
    skippedFiles,
  }

  console.log({
    repo: data.repoFullName,
    pr: data.prNumber,
    issuesFound: issues.length,
    reviewedFiles: result.reviewedFiles,
    skippedFiles,
    issues,
  })

  return result
}
