import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../src/server.js'

const secret = 'test-webhook-secret'

function pullRequestPayload(action: string) {
  return Buffer.from(
    JSON.stringify({
      action,
      repository: { full_name: 'vlad-vsdc/ai-review-bot' },
      pull_request: { number: 42, head: { sha: 'deadbeef' } },
    })
  )
}

function sign(body: Buffer): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

describe('POST /webhooks/github', () => {
  const originalSecret = process.env.WEBHOOK_SECRET

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = secret
  })

  afterEach(() => {
    process.env.WEBHOOK_SECRET = originalSecret
    vi.restoreAllMocks()
  })

  it('handles action=opened and logs the event', async () => {
    const app = buildServer()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const body = pullRequestPayload('opened')

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': sign(body),
      },
      payload: body,
    })

    expect(response.statusCode).toBe(200)
    expect(logSpy).toHaveBeenCalledWith({
      repo: 'vlad-vsdc/ai-review-bot',
      pr: 42,
      action: 'opened',
      sha: 'deadbeef',
    })
  })

  it('ignores action=closed without side effects', async () => {
    const app = buildServer()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const body = pullRequestPayload('closed')

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': sign(body),
      },
      payload: body,
    })

    expect(response.statusCode).toBe(200)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('rejects an invalid signature with 401', async () => {
    const app = buildServer()
    const body = pullRequestPayload('opened')

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': 'sha256=' + '0'.repeat(64),
      },
      payload: body,
    })

    expect(response.statusCode).toBe(401)
  })
})
