import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffFile } from '../src/pipeline/fetch-diff.js'

const files: DiffFile[] = [
  { filename: 'a.ts', patch: 'ok-a', status: 'ok' },
  { filename: 'b.ts', patch: 'FAIL', status: 'ok' },
  { filename: 'c.ts', patch: 'ok-c', status: 'ok' },
]

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
      review: (code: string) => {
        if (code === 'FAIL') return Promise.reject(new Error('groq rate limited'))
        return Promise.resolve({
          issues: [{ severity: 'info', line: 1, title: 't', description: 'd', fix: null }],
          summary: 'ok',
        })
      },
    }
  }),
}))

const getCachedInstallationTokenMock = vi.fn().mockResolvedValue('fake-token')
vi.mock('@ai-review-bot/core', () => ({
  getCachedInstallationToken: getCachedInstallationTokenMock,
}))

const postReviewMock = vi.fn().mockResolvedValue({ postedComments: 2, unmappableIssues: 0 })
vi.mock('../src/pipeline/post-review.js', () => ({
  postReview: postReviewMock,
}))

const { processPrReviewJob } = await import('../src/jobs/process-pr.js')

describe('processPrReviewJob', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('keeps issues from files that succeeded when another file review rejects', async () => {
    const result = await processPrReviewJob({
      installationId: 1,
      repoFullName: 'owner/repo',
      prNumber: 1,
      headSha: 'sha',
    })

    expect(result.issues).toHaveLength(2)
    expect(result.issues.map((issue) => issue.file)).toEqual(['a.ts', 'c.ts'])
    expect(result.reviewedFiles).toBe(2)
    expect(result.skippedFiles).toEqual([{ file: 'b.ts', reason: 'review failed' }])

    expect(postReviewMock).toHaveBeenCalledWith(
      'fake-token',
      'owner',
      'repo',
      1,
      'sha',
      result,
      new Map([
        ['a.ts', 'ok-a'],
        ['b.ts', 'FAIL'],
        ['c.ts', 'ok-c'],
      ])
    )
  })
})
