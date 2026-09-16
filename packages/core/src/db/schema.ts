export const CREATE_PR_REVIEWS_TABLE = `
  CREATE TABLE IF NOT EXISTS pr_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_full_name TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    head_sha TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_used TEXT,
    issues_found INTEGER NOT NULL,
    posted_comments INTEGER NOT NULL,
    unmappable_issues INTEGER NOT NULL,
    skipped_files_count INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
  )
`

export type ReviewStatus = 'success' | 'failed' | 'partial'
export type ProviderUsed = 'claude' | 'groq' | 'mixed'

export interface NewPrReview {
  repoFullName: string
  prNumber: number
  headSha: string
  status: ReviewStatus
  providerUsed: ProviderUsed | null
  issuesFound: number
  postedComments: number
  unmappableIssues: number
  skippedFilesCount: number
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  errorMessage: string | null
}

export interface PrReviewRecord extends NewPrReview {
  id: number
  createdAt: string
}
