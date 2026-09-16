const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function mapLineToDiffPosition(patch: string, targetLine: number): number | null {
  const lines = patch.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  let position = 0
  let newLine = 0
  let inHunk = false

  for (const line of lines) {
    position++

    const hunkMatch = HUNK_HEADER.exec(line)
    if (hunkMatch) {
      newLine = Number(hunkMatch[1])
      inHunk = true
      continue
    }

    if (!inHunk || line.startsWith('-') || line.startsWith('\\')) continue

    if (newLine === targetLine) return position
    newLine++
  }

  return null
}
