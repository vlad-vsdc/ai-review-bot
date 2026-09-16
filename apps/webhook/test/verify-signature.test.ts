import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifySignature } from '../src/verify-signature.js'

const secret = 'test-secret'
const payload = Buffer.from(JSON.stringify({ hello: 'world' }))

function sign(body: Buffer, withSecret: string): string {
  return 'sha256=' + createHmac('sha256', withSecret).update(body).digest('hex')
}

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    expect(verifySignature(payload, sign(payload, secret), secret)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const tampered = 'sha256=' + '0'.repeat(64)
    expect(verifySignature(payload, tampered, secret)).toBe(false)
  })

  it('returns false when the secret does not match', () => {
    const signature = sign(payload, 'wrong-secret')
    expect(verifySignature(payload, signature, secret)).toBe(false)
  })
})
