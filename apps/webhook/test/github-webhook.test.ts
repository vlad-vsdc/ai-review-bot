import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { addMock, setMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  setMock: vi.fn(),
}))

vi.mock('@ai-review-bot/core', () => ({
  prReviewQueue: { add: addMock },
  redisConnection: { set: setMock },
}))

const { buildServer } = await import('../src/server.js')

const secret = 'test-webhook-secret'

function pullRequestPayload(action: string) {
  return Buffer.from(
    JSON.stringify({
      action,
      installation: { id: 123 },
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
    addMock.mockReset()
    setMock.mockReset()
    setMock.mockResolvedValue('OK') // 'OK' = key did not exist yet → not throttled
  })

  afterEach(() => {
    process.env.WEBHOOK_SECRET = originalSecret
    vi.restoreAllMocks()
  })

  it('handles action=opened and enqueues a review job', async () => {
    const app = buildServer()
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
    expect(addMock).toHaveBeenCalledWith('review', {
      installationId: 123,
      repoFullName: 'vlad-vsdc/ai-review-bot',
      prNumber: 42,
      headSha: 'deadbeef',
    })
  })

  it('ignores action=closed without side effects', async () => {
    const app = buildServer()
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
    expect(addMock).not.toHaveBeenCalled()
  })

  it('throttles a second request for the same repo+pr within the window', async () => {
    const app = buildServer()
    setMock.mockResolvedValueOnce('OK').mockResolvedValueOnce(null)
    const body = pullRequestPayload('opened')
    const headers = {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': sign(body),
    }

    const first = await app.inject({ method: 'POST', url: '/webhooks/github', headers, payload: body })
    const second = await app.inject({ method: 'POST', url: '/webhooks/github', headers, payload: body })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(addMock).toHaveBeenCalledTimes(1)
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
