import { describe, expect, it } from 'vitest'
import { mapLineToDiffPosition } from '../src/map-line-to-diff-position.js'

const MULTI_HUNK_PATCH = [
  '@@ -1,3 +1,4 @@',
  ' context1',
  '+added1',
  ' context2',
  ' context3',
  '@@ -10,2 +11,3 @@',
  ' context10',
  '+added2',
  ' context11',
].join('\n')

describe('mapLineToDiffPosition', () => {
  it('maps an added line in the first hunk', () => {
    expect(mapLineToDiffPosition(MULTI_HUNK_PATCH, 2)).toBe(3)
  })

  it('maps a context line (not just added lines)', () => {
    expect(mapLineToDiffPosition(MULTI_HUNK_PATCH, 4)).toBe(5)
  })

  it('maps an added line in the second hunk, accumulating offset across hunks', () => {
    expect(mapLineToDiffPosition(MULTI_HUNK_PATCH, 12)).toBe(8)
  })

  it('returns null when the target line is not present in any hunk', () => {
    expect(mapLineToDiffPosition(MULTI_HUNK_PATCH, 999)).toBeNull()
  })

  it('does not count removed lines as new-file lines', () => {
    const patch = ['@@ -1,3 +1,2 @@', ' context1', '-removed', ' context2'].join('\n')

    // new-file line 2 is "context2", which is the 4th line of the patch (position 4)
    expect(mapLineToDiffPosition(patch, 2)).toBe(4)
  })

  it('ignores a trailing empty line produced by a trailing newline in the patch string', () => {
    expect(mapLineToDiffPosition(MULTI_HUNK_PATCH + '\n', 12)).toBe(8)
  })
})
