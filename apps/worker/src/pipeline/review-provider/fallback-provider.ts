import type { ReviewResult } from '@ai-review-bot/core'
import type { ReviewProvider } from './index.js'

export class FallbackReviewProvider implements ReviewProvider {
  constructor(
    private readonly primary: ReviewProvider,
    private readonly fallback: ReviewProvider
  ) {}

  async review(code: string, language: string): Promise<ReviewResult> {
    try {
      const result = await this.primary.review(code, language)
      console.log({ provider: 'primary' })
      return result
    } catch (error) {
      console.warn({
        provider: 'claude',
        failed: true,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    const result = await this.fallback.review(code, language)
    console.log({ provider: 'fallback' })
    return result
  }
}
