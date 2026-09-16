import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { CREATE_PR_REVIEWS_TABLE, type NewPrReview, type PrReviewRecord } from './schema.js'

let db: Database.Database | null = null

export function initDb(path: string): void {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
  db = new Database(path)
  db.exec(CREATE_PR_REVIEWS_TABLE)
}

function requireDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDb() first')
  return db
}

const INSERT_REVIEW = `
  INSERT INTO pr_reviews (
    repo_full_name, pr_number, head_sha, status, provider_used,
    issues_found, posted_comments, unmappable_issues, skipped_files_count,
    input_tokens, output_tokens, duration_ms, error_message
  ) VALUES (
    @repoFullName, @prNumber, @headSha, @status, @providerUsed,
    @issuesFound, @postedComments, @unmappableIssues, @skippedFilesCount,
    @inputTokens, @outputTokens, @durationMs, @errorMessage
  )
`

export function recordReview(entry: NewPrReview): void {
  requireDb().prepare(INSERT_REVIEW).run(entry)
}

export function listReviews(): PrReviewRecord[] {
  const rows = requireDb().prepare('SELECT * FROM pr_reviews ORDER BY id').all() as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as number,
    repoFullName: row.repo_full_name as string,
    prNumber: row.pr_number as number,
    headSha: row.head_sha as string,
    status: row.status as PrReviewRecord['status'],
    providerUsed: row.provider_used as PrReviewRecord['providerUsed'],
    issuesFound: row.issues_found as number,
    postedComments: row.posted_comments as number,
    unmappableIssues: row.unmappable_issues as number,
    skippedFilesCount: row.skipped_files_count as number,
    inputTokens: row.input_tokens as number | null,
    outputTokens: row.output_tokens as number | null,
    durationMs: row.duration_ms as number,
    createdAt: row.created_at as string,
    errorMessage: row.error_message as string | null,
  }))
}
