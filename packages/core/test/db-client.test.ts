import { beforeEach, describe, expect, it } from 'vitest'
import { initDb, recordReview, listReviews, getStats } from '../src/db/client.js'
import type { NewPrReview } from '../src/db/schema.js'

const baseEntry: NewPrReview = {
  repoFullName: 'acme/widgets',
  prNumber: 42,
  headSha: 'abc123',
  status: 'success',
  providerUsed: 'claude',
  issuesFound: 3,
  postedComments: 2,
  unmappableIssues: 1,
  skippedFilesCount: 0,
  inputTokens: 500,
  outputTokens: 200,
  durationMs: 1234,
  errorMessage: null,
}

describe('db client', () => {
  beforeEach(() => {
    initDb(':memory:')
  })

  it('writes and reads back a review record with the correct fields', () => {
    recordReview(baseEntry)

    const rows = listReviews()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject(baseEntry)
    expect(rows[0].id).toBe(1)
    expect(typeof rows[0].createdAt).toBe('string')
  })

  it('preserves nullable fields as null (not undefined or 0)', () => {
    recordReview({
      ...baseEntry,
      providerUsed: null,
      inputTokens: null,
      outputTokens: null,
      errorMessage: 'boom',
      status: 'failed',
    })

    const [row] = listReviews()

    expect(row.providerUsed).toBeNull()
    expect(row.inputTokens).toBeNull()
    expect(row.outputTokens).toBeNull()
    expect(row.errorMessage).toBe('boom')
    expect(row.status).toBe('failed')
  })

  it('records multiple reviews in insertion order', () => {
    recordReview({ ...baseEntry, prNumber: 1 })
    recordReview({ ...baseEntry, prNumber: 2 })

    const rows = listReviews()

    expect(rows.map((row) => row.prNumber)).toEqual([1, 2])
  })
})

describe('getStats', () => {
  beforeEach(() => {
    initDb(':memory:')
  })

  it('returns zeroed aggregates and null usage/duration when there are no reviews', () => {
    const stats = getStats()

    expect(stats.totalReviews).toBe(0)
    expect(stats.byStatus).toEqual({ success: 0, failed: 0, partial: 0 })
    expect(stats.byProvider).toEqual({ claude: 0, groq: 0, mixed: 0 })
    expect(stats.totalIssuesFound).toBe(0)
    expect(stats.totalPostedComments).toBe(0)
    expect(stats.totalUnmappableIssues).toBe(0)
    expect(stats.totalInputTokens).toBeNull()
    expect(stats.totalOutputTokens).toBeNull()
    expect(stats.avgDurationMs).toBeNull()
    expect(stats.recentReviews).toEqual([])
  })

  it('aggregates counts, sums usage ignoring NULL rows, and averages duration', () => {
    recordReview({ ...baseEntry, prNumber: 1, status: 'success', providerUsed: 'claude', issuesFound: 3, postedComments: 2, unmappableIssues: 1, inputTokens: 100, outputTokens: 50, durationMs: 1000 })
    recordReview({ ...baseEntry, prNumber: 2, status: 'partial', providerUsed: 'mixed', issuesFound: 5, postedComments: 4, unmappableIssues: 0, inputTokens: 200, outputTokens: 80, durationMs: 2000 })
    recordReview({ ...baseEntry, prNumber: 3, status: 'failed', providerUsed: null, issuesFound: 0, postedComments: 0, unmappableIssues: 0, inputTokens: null, outputTokens: null, durationMs: 3000, errorMessage: 'boom' })

    const stats = getStats()

    expect(stats.totalReviews).toBe(3)
    expect(stats.byStatus).toEqual({ success: 1, failed: 1, partial: 1 })
    expect(stats.byProvider).toEqual({ claude: 1, groq: 0, mixed: 1 })
    expect(stats.totalIssuesFound).toBe(8)
    expect(stats.totalPostedComments).toBe(6)
    expect(stats.totalUnmappableIssues).toBe(1)
    // Third row has NULL usage — SUM must ignore it, not treat it as 0.
    expect(stats.totalInputTokens).toBe(300)
    expect(stats.totalOutputTokens).toBe(130)
    expect(stats.avgDurationMs).toBe(2000)
  })

  it('returns null totals when every row has NULL usage (not 0)', () => {
    recordReview({ ...baseEntry, prNumber: 1, inputTokens: null, outputTokens: null })
    recordReview({ ...baseEntry, prNumber: 2, inputTokens: null, outputTokens: null })

    const stats = getStats()

    expect(stats.totalInputTokens).toBeNull()
    expect(stats.totalOutputTokens).toBeNull()
  })

  it('returns at most the 10 most recent reviews, newest first, without error_message', () => {
    for (let i = 1; i <= 12; i++) {
      recordReview({ ...baseEntry, prNumber: i })
    }

    const stats = getStats()

    expect(stats.recentReviews).toHaveLength(10)
    expect(stats.recentReviews.map((r) => r.prNumber)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3])
    expect(stats.recentReviews[0]).not.toHaveProperty('errorMessage')
  })
})
