import OpenAI from 'openai'
import { buildReviewPrompt, type ReviewResult } from '@ai-review-bot/core'
import type { ReviewProvider } from './index.js'

const GROQ_MODEL = 'openai/gpt-oss-120b'

export class GroqProvider implements ReviewProvider {
  private readonly client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
  }

  async review(code: string, language: string): Promise<ReviewResult> {
    const completion = await this.client.chat.completions.create({
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildReviewPrompt(code, language) }],
    })

    return JSON.parse(completion.choices[0]?.message?.content ?? '{}') as ReviewResult
  }
}
