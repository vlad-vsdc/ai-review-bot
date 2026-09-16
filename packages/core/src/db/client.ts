import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  CREATE_PR_REVIEWS_TABLE,
  type NewPrReview,
  type PrReviewRecord,
  type ProviderUsed,
  type ReviewStatus,
} from './schema.js'

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

const STATUSES: ReviewStatus[] = ['success', 'failed', 'partial']
const PROVIDERS: ProviderUsed[] = ['claude', 'groq', 'mixed']

export interface RecentReview {
  repoFullName: string
  prNumber: number
  status: ReviewStatus
  providerUsed: ProviderUsed | null
  issuesFound: number
  postedComments: number
  createdAt: string
}

export interface StatsSummary {
  totalReviews: number
  byStatus: Record<ReviewStatus, number>
  byProvider: Record<ProviderUsed, number>
  totalIssuesFound: number
  totalPostedComments: number
  totalUnmappableIssues: number
  totalInputTokens: number | null
  totalOutputTokens: number | null
  avgDurationMs: number | null
  recentReviews: RecentReview[]
}

export function getStats(): StatsSummary {
  const database = requireDb()

  const { totalReviews } = database.prepare('SELECT COUNT(*) as totalReviews FROM pr_reviews').get() as {
    totalReviews: number
  }

  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ReviewStatus, number>
  for (const row of database.prepare('SELECT status, COUNT(*) as count FROM pr_reviews GROUP BY status').all() as Array<{
    status: ReviewStatus
    count: number
  }>) {
    byStatus[row.status] = row.count
  }

  const byProvider = Object.fromEntries(PROVIDERS.map((provider) => [provider, 0])) as Record<ProviderUsed, number>
  for (const row of database
    .prepare('SELECT provider_used, COUNT(*) as count FROM pr_reviews WHERE provider_used IS NOT NULL GROUP BY provider_used')
    .all() as Array<{ provider_used: ProviderUsed; count: number }>) {
    byProvider[row.provider_used] = row.count
  }

  // SUM() over a column that is entirely NULL (or over zero rows) returns NULL in SQLite,
  // which is exactly the "no usage data available" signal we want to surface as null.
  const totals = database
    .prepare(
      `SELECT
        COALESCE(SUM(issues_found), 0) as totalIssuesFound,
        COALESCE(SUM(posted_comments), 0) as totalPostedComments,
        COALESCE(SUM(unmappable_issues), 0) as totalUnmappableIssues,
        SUM(input_tokens) as totalInputTokens,
        SUM(output_tokens) as totalOutputTokens,
        AVG(duration_ms) as avgDurationMs
      FROM pr_reviews`
    )
    .get() as {
    totalIssuesFound: number
    totalPostedComments: number
    totalUnmappableIssues: number
    totalInputTokens: number | null
    totalOutputTokens: number | null
    avgDurationMs: number | null
  }

  const recentRows = database
    .prepare(
      `SELECT repo_full_name, pr_number, status, provider_used, issues_found, posted_comments, created_at
       FROM pr_reviews ORDER BY id DESC LIMIT 10`
    )
    .all() as Array<{
    repo_full_name: string
    pr_number: number
    status: ReviewStatus
    provider_used: ProviderUsed | null
    issues_found: number
    posted_comments: number
    created_at: string
  }>

  return {
    totalReviews,
    byStatus,
    byProvider,
    ...totals,
    recentReviews: recentRows.map((row) => ({
      repoFullName: row.repo_full_name,
      prNumber: row.pr_number,
      status: row.status,
      providerUsed: row.provider_used,
      issuesFound: row.issues_found,
      postedComments: row.posted_comments,
      createdAt: row.created_at,
    })),
  }
}
