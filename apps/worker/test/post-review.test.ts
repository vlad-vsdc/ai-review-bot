import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrReviewOutcome } from '../src/jobs/process-pr.js'
import { postReview } from '../src/pipeline/post-review.js'

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 422,
    statusText: ok ? 'OK' : 'Unprocessable Entity',
    json: async () => body,
  }
}

describe('postReview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const patch = ['@@ -1,2 +1,3 @@', ' context1', '+added1', ' context2'].join('\n')

  it('posts inline comments for mappable issues and includes them in the request body', async () => {
    const outcome: PrReviewOutcome = {
      issues: [{ file: 'a.ts', severity: 'warning', line: 2, title: 't', description: 'd', fix: null }],
      reviewedFiles: 1,
      skippedFiles: [],
    }

    const result = await postReview(
      'token',
      'owner',
      'repo',
      7,
      'sha',
      outcome,
      new Map([['a.ts', patch]])
    )

    expect(result).toEqual({ postedComments: 1, unmappableIssues: 0 })

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/owner/repo/pulls/7/reviews')
    const body = JSON.parse(init.body)
    expect(body.event).toBe('COMMENT')
    expect(body.commit_id).toBe('sha')
    expect(body.comments).toEqual([{ path: 'a.ts', position: 3, body: expect.stringContaining('t') }])
  })

  it('keeps an unmappable issue out of comments[] but mentions it in the summary body', async () => {
    const outcome: PrReviewOutcome = {
      issues: [{ file: 'a.ts', severity: 'info', line: 999, title: 't', description: 'd', fix: null }],
      reviewedFiles: 1,
      skippedFiles: [],
    }

    const result = await postReview('token', 'owner', 'repo', 7, 'sha', outcome, new Map([['a.ts', patch]]))

    expect(result).toEqual({ postedComments: 0, unmappableIssues: 1 })

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.comments).toEqual([])
    expect(body.body).toContain('1 issue(s) found outside the diff view and not shown inline')
  })

  it('includes a "could not review" line only when skippedFiles is non-empty', async () => {
    const withSkipped: PrReviewOutcome = { issues: [], reviewedFiles: 1, skippedFiles: [{ file: 'b.ts', reason: 'review failed' }] }
    await postReview('token', 'owner', 'repo', 7, 'sha', withSkipped, new Map())
    const bodyWithSkipped = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body).body
    expect(bodyWithSkipped).toContain('Could not review: b.ts (review failed)')

    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))

    const noSkipped: PrReviewOutcome = { issues: [], reviewedFiles: 1, skippedFiles: [] }
    await postReview('token', 'owner', 'repo', 7, 'sha', noSkipped, new Map())
    const bodyWithoutSkipped = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body).body
    expect(bodyWithoutSkipped).not.toContain('Could not review')
  })

  it('does not throw when the GitHub API rejects the whole review request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'invalid position' }, false)))

    const outcome: PrReviewOutcome = {
      issues: [{ file: 'a.ts', severity: 'warning', line: 2, title: 't', description: 'd', fix: null }],
      reviewedFiles: 1,
      skippedFiles: [],
    }

    const result = await postReview('token', 'owner', 'repo', 7, 'sha', outcome, new Map([['a.ts', patch]]))

    expect(result).toEqual({ postedComments: 0, unmappableIssues: 0 })
    expect(console.error).toHaveBeenCalled()
  })

  it('does not throw when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const outcome: PrReviewOutcome = { issues: [], reviewedFiles: 0, skippedFiles: [] }
    const result = await postReview('token', 'owner', 'repo', 7, 'sha', outcome, new Map())

    expect(result).toEqual({ postedComments: 0, unmappableIssues: 0 })
    expect(console.error).toHaveBeenCalled()
  })
})
