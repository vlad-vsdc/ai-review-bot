import type { Issue } from '@ai-review-bot/core'
import { mapLineToDiffPosition } from '@ai-review-bot/core'
import type { PrReviewOutcome } from '../jobs/process-pr.js'

export interface PostReviewResult {
  postedComments: number
  unmappableIssues: number
}

interface ReviewComment {
  path: string
  position: number
  body: string
}

function formatCommentBody(issue: Issue): string {
  const lines = [`**[${issue.severity}] ${issue.title}**`, '', issue.description]
  if (issue.fix) {
    lines.push('', `Suggested fix: ${issue.fix}`)
  }
  return lines.join('\n')
}

function buildSummary(outcome: PrReviewOutcome, unmappableCount: number): string {
  const lines = [`Reviewed ${outcome.reviewedFiles} files, ${outcome.issues.length} issues found`]

  if (outcome.skippedFiles.length > 0) {
    const files = outcome.skippedFiles.map((skipped) => skipped.file).join(', ')
    lines.push(`Could not review: ${files} (review failed)`)
  }

  if (unmappableCount > 0) {
    lines.push(`${unmappableCount} issue(s) found outside the diff view and not shown inline`)
  }

  return lines.join('\n\n')
}

export async function postReview(
  installationToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  headSha: string,
  outcome: PrReviewOutcome,
  filePatches: Map<string, string>
): Promise<PostReviewResult> {
  const comments: ReviewComment[] = []
  let unmappableIssues = 0

  for (const issue of outcome.issues) {
    const patch = filePatches.get(issue.file)
    const position = patch ? mapLineToDiffPosition(patch, issue.line) : null

    if (position === null) {
      unmappableIssues++
      continue
    }

    comments.push({ path: issue.file, position, body: formatCommentBody(issue) })
  }

  const body = buildSummary(outcome, unmappableIssues)
  let postedComments = 0

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commit_id: headSha, body, event: 'COMMENT', comments }),
    })

    if (response.ok) {
      postedComments = comments.length
    } else {
      console.error({
        repo: `${owner}/${repo}`,
        pr: prNumber,
        error: `Failed to post review: ${response.status} ${response.statusText}`,
      })
    }
  } catch (error) {
    console.error({
      repo: `${owner}/${repo}`,
      pr: prNumber,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { postedComments, unmappableIssues }
}
