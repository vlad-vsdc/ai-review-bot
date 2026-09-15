export type Severity = 'critical' | 'warning' | 'info' | 'good'

export interface Issue {
  file: string
  severity: Severity
  line: number
  title: string
  description: string
  fix: string | null
}

export interface ReviewResult {
  issues: Issue[]
  summary: string
}
