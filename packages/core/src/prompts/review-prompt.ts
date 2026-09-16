export const buildReviewPrompt = (code: string, language: string): string => `
You are an expert code reviewer. Analyze the following ${language} code and return a JSON response only — no markdown, no explanation outside the JSON.

Respond with this exact structure:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info" | "good",
      "line": <line number as integer>,
      "title": "<short title>",
      "description": "<what the problem is and why it matters>",
      "fix": "<concrete fix suggestion or null if severity is good>"
    }
  ],
  "summary": "<one sentence overall assessment>"
}

Severity rules:
- critical: security vulnerabilities, bugs that crash or corrupt data
- warning: bad practices, performance issues, potential bugs
- info: style, readability, minor improvements
- good: highlight something done well (include 1-2 positives)

Code to review:
\`\`\`${language}
${code}
\`\`\`
`
