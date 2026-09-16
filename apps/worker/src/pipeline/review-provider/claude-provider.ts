import Anthropic from '@anthropic-ai/sdk'
import { buildReviewPrompt, type ReviewResult } from '@ai-review-bot/core'
import type { ReviewProvider } from './index.js'

const CLAUDE_MODEL = 'claude-sonnet-5'

export class ClaudeProvider implements ReviewProvider {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async review(code: string, language: string): Promise<ReviewResult> {
    const message = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildReviewPrompt(code, language) }],
    })

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // The review prompt's JSON schema intentionally omits `file` — the caller
    // attaches the real filename after this call, once per diff file.
    return JSON.parse(text) as ReviewResult
  }
}
