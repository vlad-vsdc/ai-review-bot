import { beforeEach, describe, expect, it } from 'vitest'
import { initDb, recordReview } from '@ai-review-bot/core'
import { buildServer } from '../src/server.js'

describe('GET /stats', () => {
  beforeEach(() => {
    initDb(':memory:')
  })

  it('returns 200 with the aggregated JSON summary', async () => {
    recordReview({
      repoFullName: 'acme/widgets',
      prNumber: 7,
      headSha: 'sha7',
      status: 'success',
      providerUsed: 'claude',
      issuesFound: 3,
      postedComments: 2,
      unmappableIssues: 1,
      skippedFilesCount: 0,
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 500,
      errorMessage: null,
    })

    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/stats' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')

    const body = response.json()
    expect(body.totalReviews).toBe(1)
    expect(body.byStatus).toEqual({ success: 1, failed: 0, partial: 0 })
    expect(body.byProvider).toEqual({ claude: 1, groq: 0, mixed: 0 })
    expect(body.totalIssuesFound).toBe(3)
    expect(body.totalPostedComments).toBe(2)
    expect(body.totalUnmappableIssues).toBe(1)
    expect(body.totalInputTokens).toBe(100)
    expect(body.totalOutputTokens).toBe(50)
    expect(body.avgDurationMs).toBe(500)
    expect(body.recentReviews).toEqual([
      {
        repoFullName: 'acme/widgets',
        prNumber: 7,
        status: 'success',
        providerUsed: 'claude',
        issuesFound: 3,
        postedComments: 2,
        createdAt: expect.any(String),
      },
    ])
  })

  it('returns a well-formed empty summary when there are no reviews yet', async () => {
    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/stats' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      totalReviews: 0,
      byStatus: { success: 0, failed: 0, partial: 0 },
      byProvider: { claude: 0, groq: 0, mixed: 0 },
      recentReviews: [],
    })
  })
})
