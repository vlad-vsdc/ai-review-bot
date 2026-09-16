import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initDb, listReviews } from '@ai-review-bot/core'
import type { DiffFile } from '../src/pipeline/fetch-diff.js'

// Only the external-network pipeline stages are mocked here (GitHub, LLM providers,
// posting comments). @ai-review-bot/core is left real, so this exercises the actual
// initDb/recordReview wiring against a real (in-memory) SQLite database.

const files: DiffFile[] = [{ filename: 'a.ts', patch: 'ok-a', status: 'ok' }]

vi.mock('../src/pipeline/fetch-diff.js', () => ({
  fetchPrDiff: vi.fn().mockResolvedValue(files),
}))

vi.mock('../src/pipeline/review-provider/claude-provider.js', () => ({
  ClaudeProvider: vi.fn(),
}))

vi.mock('../src/pipeline/review-provider/groq-provider.js', () => ({
  GroqProvider: vi.fn(),
}))

vi.mock('../src/pipeline/review-provider/fallback-provider.js', () => ({
  FallbackReviewProvider: vi.fn().mockImplementation(function () {
    return {
      review: () =>
        Promise.resolve({
          issues: [{ severity: 'info', line: 1, title: 't', description: 'd', fix: null }],
          summary: 'ok',
        }),
      getUsageSummary: () => ({ inputTokens: 42, outputTokens: 17, providerUsed: 'claude' }),
    }
  }),
}))

vi.mock('../src/pipeline/post-review.js', () => ({
  postReview: vi.fn().mockResolvedValue({ postedComments: 1, unmappableIssues: 0 }),
}))

// getCachedInstallationToken is part of the real @ai-review-bot/core module used here,
// so it must be stubbed to avoid a real network call — everything else in core is real.
vi.mock('@ai-review-bot/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-review-bot/core')>()
  return { ...actual, getCachedInstallationToken: vi.fn().mockResolvedValue('fake-token') }
})

const { processPrReviewJob } = await import('../src/jobs/process-pr.js')

describe('processPrReviewJob (real db)', () => {
  beforeEach(() => {
    initDb(':memory:')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('writes a real row via recordReview after a successful job', async () => {
    await processPrReviewJob({
      installationId: 1,
      repoFullName: 'owner/repo',
      prNumber: 5,
      headSha: 'sha5',
    })

    const rows = listReviews()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      repoFullName: 'owner/repo',
      prNumber: 5,
      headSha: 'sha5',
      status: 'success',
      providerUsed: 'claude',
      issuesFound: 1,
      postedComments: 1,
      unmappableIssues: 0,
      skippedFilesCount: 0,
      inputTokens: 42,
      outputTokens: 17,
    })
  })
})
