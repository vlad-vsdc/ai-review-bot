import type { ProviderUsed, ReviewResult } from '@ai-review-bot/core'
import type { ReviewProvider } from './index.js'

export interface UsageSummary {
  inputTokens: number | null
  outputTokens: number | null
  providerUsed: ProviderUsed | null
}

export class FallbackReviewProvider implements ReviewProvider {
  private inputTokens = 0
  private outputTokens = 0
  private hasUsage = false
  private usedClaude = false
  private usedGroq = false

  constructor(
    private readonly primary: ReviewProvider,
    private readonly fallback: ReviewProvider
  ) {}

  async review(code: string, language: string): Promise<ReviewResult> {
    try {
      const result = await this.primary.review(code, language)
      console.log({ provider: 'primary' })
      this.recordUsage('claude', result)
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
    this.recordUsage('groq', result)
    return result
  }

  getUsageSummary(): UsageSummary {
    let providerUsed: ProviderUsed | null = null
    if (this.usedClaude && this.usedGroq) providerUsed = 'mixed'
    else if (this.usedClaude) providerUsed = 'claude'
    else if (this.usedGroq) providerUsed = 'groq'

    return {
      inputTokens: this.hasUsage ? this.inputTokens : null,
      outputTokens: this.hasUsage ? this.outputTokens : null,
      providerUsed,
    }
  }

  private recordUsage(provider: 'claude' | 'groq', result: ReviewResult): void {
    if (provider === 'claude') this.usedClaude = true
    else this.usedGroq = true

    if (result.usage) {
      this.hasUsage = true
      this.inputTokens += result.usage.inputTokens
      this.outputTokens += result.usage.outputTokens
    }
  }
}
