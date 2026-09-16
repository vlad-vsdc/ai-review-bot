import { extname } from 'node:path'
import { getCachedInstallationToken } from '@ai-review-bot/core'

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py'])

export interface DiffFile {
  filename: string
  patch: string | null
  status: 'ok' | 'skipped:too-large'
}

export interface FetchPrDiffParams {
  appId: string
  privateKeyPath: string
  installationId: number
  owner: string
  repo: string
  prNumber: number
}

export async function fetchPrDiff(params: FetchPrDiffParams): Promise<DiffFile[]> {
  const token = await getCachedInstallationToken(params.appId, params.privateKeyPath, params.installationId)
  const maxLines = Number(process.env.MAX_DIFF_LINES_PER_FILE) || 800

  const response = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}/files?per_page=100`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch PR files: ${response.status} ${response.statusText}`)
  }

  const files = (await response.json()) as Array<{ filename: string; patch?: string; changes: number }>
  const result: DiffFile[] = []

  for (const file of files) {
    if (!ALLOWED_EXTENSIONS.has(extname(file.filename))) continue

    if (!file.patch || file.changes > maxLines) {
      result.push({ filename: file.filename, patch: null, status: 'skipped:too-large' })
      continue
    }

    result.push({ filename: file.filename, patch: file.patch, status: 'ok' })
  }

  return result
}
