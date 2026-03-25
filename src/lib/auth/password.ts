import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

/**
 * Hash a plaintext password using bcrypt with a server-side pepper.
 *
 * The pepper is read from `PEPPER_SECRET` env var at call time (not module
 * load time) so tests can override it per-case.
 *
 * @param plaintext - The user's raw password
 * @returns The bcrypt hash of (plaintext + pepper)
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const pepper = process.env.PEPPER_SECRET || ''
  return bcrypt.hash(plaintext + pepper, BCRYPT_ROUNDS)
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 *
 * @param plaintext - The user's raw password
 * @param hash - The stored bcrypt hash
 * @returns true if (plaintext + pepper) matches the hash
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  const pepper = process.env.PEPPER_SECRET || ''
  return bcrypt.compare(plaintext + pepper, hash)
}
