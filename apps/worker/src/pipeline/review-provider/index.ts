import type { ReviewResult } from '@ai-review-bot/core'

export interface ReviewProvider {
  review(code: string, language: string): Promise<ReviewResult>
}
