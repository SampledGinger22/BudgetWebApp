/**
 * Password utility unit tests — no DB required.
 *
 * Proves bcrypt+pepper hashing contract:
 * - Hashes are bcrypt format ($2a/$2b prefix, 12 rounds)
 * - Correct password verifies, wrong password doesn't
 * - Pepper is applied (changing pepper invalidates hash)
 * - Salt randomness ensures different hashes for same input
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

const TEST_PEPPER = 'test-pepper-secret-12345'

describe('Password utilities (no DB)', () => {
  let originalPepper: string | undefined

  beforeEach(() => {
    originalPepper = process.env.PEPPER_SECRET
    process.env.PEPPER_SECRET = TEST_PEPPER
  })

  afterEach(() => {
    if (originalPepper === undefined) {
      delete process.env.PEPPER_SECRET
    } else {
      process.env.PEPPER_SECRET = originalPepper
    }
  })

  it('hashPassword() returns a bcrypt hash string', async () => {
    const hash = await hashPassword('MySecretPass1!')
    // bcrypt hashes start with $2a$ or $2b$ followed by the cost factor
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/)
    // Verify 12 rounds in the hash
    expect(hash).toMatch(/^\$2[ab]\$12\$/)
  })

  it('verifyPassword() returns true for the correct password', async () => {
    const password = 'CorrectHorseBatteryStaple'
    const hash = await hashPassword(password)
    const result = await verifyPassword(password, hash)
    expect(result).toBe(true)
  })

  it('verifyPassword() returns false for the wrong password', async () => {
    const hash = await hashPassword('RealPassword123')
    const result = await verifyPassword('WrongPassword456', hash)
    expect(result).toBe(false)
  })

  it('pepper is applied — changing pepper invalidates existing hash', async () => {
    const password = 'PepperTestPass!'
    // Hash with current pepper
    const hash = await hashPassword(password)

    // Verify works with same pepper
    expect(await verifyPassword(password, hash)).toBe(true)

    // Change pepper — same password should now fail verification
    process.env.PEPPER_SECRET = 'different-pepper-value'
    expect(await verifyPassword(password, hash)).toBe(false)

    // Restore original pepper — should verify again
    process.env.PEPPER_SECRET = TEST_PEPPER
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('hashPassword() produces different hashes for the same input (random salt)', async () => {
    const password = 'SamePasswordTwice!'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    // Both hashes are valid bcrypt
    expect(hash1).toMatch(/^\$2[ab]\$12\$/)
    expect(hash2).toMatch(/^\$2[ab]\$12\$/)

    // But they differ due to random salt
    expect(hash1).not.toBe(hash2)

    // Both still verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true)
    expect(await verifyPassword(password, hash2)).toBe(true)
  })

  it('empty pepper still works (no PEPPER_SECRET set)', async () => {
    delete process.env.PEPPER_SECRET
    const password = 'NoPepperPassword!'
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })
})
