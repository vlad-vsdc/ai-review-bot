import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCachedInstallationTokenMock = vi.fn()

vi.mock('@ai-review-bot/core', () => ({
  getCachedInstallationToken: getCachedInstallationTokenMock,
}))

const { fetchPrDiff } = await import('../src/pipeline/fetch-diff.js')

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => body,
  }
}

describe('fetchPrDiff', () => {
  const originalMaxLines = process.env.MAX_DIFF_LINES_PER_FILE

  beforeEach(() => {
    getCachedInstallationTokenMock.mockReset()
    getCachedInstallationTokenMock.mockResolvedValue('fake-token')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.MAX_DIFF_LINES_PER_FILE = originalMaxLines
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('excludes files with disallowed extensions', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse([{ filename: 'README.md', patch: '+ hello', changes: 1 }])
    )

    const result = await fetchPrDiff({
      appId: 'app-id',
      privateKeyPath: '/tmp/key.pem',
      installationId: 1,
      owner: 'acme',
      repo: 'widgets',
      prNumber: 7,
    })

    expect(result).toEqual([])
  })

  it('marks files exceeding MAX_DIFF_LINES_PER_FILE as skipped:too-large', async () => {
    process.env.MAX_DIFF_LINES_PER_FILE = '10'
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse([{ filename: 'src/big.ts', patch: '+ a lot of lines', changes: 50 }])
    )

    const result = await fetchPrDiff({
      appId: 'app-id',
      privateKeyPath: '/tmp/key.pem',
      installationId: 1,
      owner: 'acme',
      repo: 'widgets',
      prNumber: 7,
    })

    expect(result).toEqual([{ filename: 'src/big.ts', patch: null, status: 'skipped:too-large' }])
  })

  it('includes ordinary .ts files with status ok', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse([{ filename: 'src/index.ts', patch: '+ const x = 1', changes: 5 }])
    )

    const result = await fetchPrDiff({
      appId: 'app-id',
      privateKeyPath: '/tmp/key.pem',
      installationId: 1,
      owner: 'acme',
      repo: 'widgets',
      prNumber: 7,
    })

    expect(result).toEqual([{ filename: 'src/index.ts', patch: '+ const x = 1', status: 'ok' }])
  })
})
