import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffFile } from '../src/pipeline/fetch-diff.js'

const files: DiffFile[] = [
  { filename: 'a.ts', patch: 'ok-a', status: 'ok' },
  { filename: 'b.ts', patch: 'FAIL', status: 'ok' },
  { filename: 'c.ts', patch: 'ok-c', status: 'ok' },
]

const fetchPrDiffMock = vi.fn().mockResolvedValue(files)
vi.mock('../src/pipeline/fetch-diff.js', () => ({
  fetchPrDiff: fetchPrDiffMock,
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
      getUsageSummary: () => ({ inputTokens: 100, outputTokens: 50, providerUsed: 'claude' }),
    }
  }),
}))

const getCachedInstallationTokenMock = vi.fn().mockResolvedValue('fake-token')
const recordReviewMock = vi.fn()
vi.mock('@ai-review-bot/core', () => ({
  getCachedInstallationToken: getCachedInstallationTokenMock,
  recordReview: recordReviewMock,
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
    fetchPrDiffMock.mockReset().mockResolvedValue(files)
    recordReviewMock.mockReset()
    postReviewMock.mockClear()
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

    expect(recordReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repoFullName: 'owner/repo',
        prNumber: 1,
        headSha: 'sha',
        status: 'partial',
        providerUsed: 'claude',
        issuesFound: 2,
        postedComments: 2,
        unmappableIssues: 0,
        skippedFilesCount: 1,
        inputTokens: 100,
        outputTokens: 50,
        errorMessage: null,
      })
    )
  })

  it('records a failed review when the job throws before any review happens (e.g. fetch-diff)', async () => {
    fetchPrDiffMock.mockRejectedValueOnce(new Error('GitHub API is down'))

    await expect(
      processPrReviewJob({
        installationId: 1,
        repoFullName: 'owner/repo',
        prNumber: 9,
        headSha: 'deadbeef',
      })
    ).rejects.toThrow('GitHub API is down')

    expect(recordReviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repoFullName: 'owner/repo',
        prNumber: 9,
        headSha: 'deadbeef',
        status: 'failed',
        providerUsed: null,
        issuesFound: 0,
        postedComments: 0,
        unmappableIssues: 0,
        skippedFilesCount: 0,
        inputTokens: null,
        outputTokens: null,
        errorMessage: 'GitHub API is down',
      })
    )
    expect(postReviewMock).not.toHaveBeenCalled()
  })
})
