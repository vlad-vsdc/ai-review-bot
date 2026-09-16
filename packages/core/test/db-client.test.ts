import { beforeEach, describe, expect, it } from 'vitest'
import { initDb, recordReview, listReviews } from '../src/db/client.js'
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
