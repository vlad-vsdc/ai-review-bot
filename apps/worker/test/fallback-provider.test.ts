import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewResult } from '@ai-review-bot/core'
import type { ReviewProvider } from '../src/pipeline/review-provider/index.js'
import { FallbackReviewProvider } from '../src/pipeline/review-provider/fallback-provider.js'

describe('FallbackReviewProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the secondary provider when the primary fails', async () => {
    const fallbackResult: ReviewResult = { issues: [], summary: 'fallback summary' }

    const primary: ReviewProvider = { review: vi.fn().mockRejectedValue(new Error('boom')) }
    const fallback: ReviewProvider = { review: vi.fn().mockResolvedValue(fallbackResult) }

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const provider = new FallbackReviewProvider(primary, fallback)
    const result = await provider.review('const x = 1', 'typescript')

    expect(result).toBe(fallbackResult)
    expect(primary.review).toHaveBeenCalledTimes(1)
    expect(fallback.review).toHaveBeenCalledTimes(1)
  })

  it('reports providerUsed=mixed and sums tokens when both providers were used across calls', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // First call: primary (Claude) succeeds.
    const primary: ReviewProvider = {
      review: vi
        .fn()
        .mockResolvedValueOnce({
          issues: [],
          summary: 'ok',
          usage: { inputTokens: 100, outputTokens: 40 },
        } satisfies ReviewResult)
        .mockRejectedValueOnce(new Error('claude down')),
    }
    // Second call: primary fails, fallback (Groq) is used instead.
    const fallback: ReviewProvider = {
      review: vi.fn().mockResolvedValue({
        issues: [],
        summary: 'ok',
        usage: { inputTokens: 30, outputTokens: 10 },
      } satisfies ReviewResult),
    }

    const provider = new FallbackReviewProvider(primary, fallback)
    await provider.review('file-a', 'typescript')
    await provider.review('file-b', 'typescript')

    expect(provider.getUsageSummary()).toEqual({
      inputTokens: 130,
      outputTokens: 50,
      providerUsed: 'mixed',
    })
  })

  it('reports null token counts when no provider returned usage data', async () => {
    const primary: ReviewProvider = { review: vi.fn().mockResolvedValue({ issues: [], summary: 'ok' }) }
    const fallback: ReviewProvider = { review: vi.fn() }

    const provider = new FallbackReviewProvider(primary, fallback)
    await provider.review('code', 'typescript')

    expect(provider.getUsageSummary()).toEqual({
      inputTokens: null,
      outputTokens: null,
      providerUsed: 'claude',
    })
  })
})
