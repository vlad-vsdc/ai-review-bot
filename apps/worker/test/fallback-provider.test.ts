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
})
