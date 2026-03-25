/**
 * Auth integration tests — requires Postgres connection.
 *
 * Tests the registration endpoint, password hash storage, and validation
 * rules. Skips gracefully when DATABASE_URL is not set or the DB is
 * unreachable (follows the S01 smoke.test.ts pattern).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { eq, sql, like } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { verifyPassword } from '../password'

const { users, households } = schema

const TEST_EMAIL_PATTERN = '%test-auth-%@example.com'
const TEST_EMAIL = 'test-auth-integration@example.com'
const TEST_PASSWORD = 'TestPass123!'
const TEST_NAME = 'Test Auth User'

type Db = ReturnType<typeof drizzle<typeof schema>> | ReturnType<typeof drizzleNeon<typeof schema>>

let db: Db
let pool: pg.Pool | null = null
let dbReachable = false

function createTestDb() {
  const url = process.env.DATABASE_URL!
  if (url.includes('.neon.tech')) {
    const client = neon(url)
    return drizzleNeon(client, { schema })
  }
  pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 3000 })
  return drizzle(pool, { schema })
}

async function checkConnection(database: Db): Promise<boolean> {
  try {
    await database.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

/**
 * Helper: call the registration route handler directly (no HTTP server needed).
 * Creates a mock Request and invokes the POST handler from route.ts.
 */
async function callRegister(body: Record<string, unknown>) {
  // Dynamic import to avoid top-level side effects (DB init) when DB isn't available
  const { POST } = await import('@/app/api/auth/register/route')
  const request = new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // The route handler expects NextRequest but Request works for testing purposes
  return POST(request as any)
}

/**
 * Clean up any test users and their households created during tests.
 */
async function cleanupTestData() {
  try {
    // Find test users matching our pattern
    const testUsers = await db
      .select({ id: users.id, household_id: users.household_id })
      .from(users)
      .where(like(users.email, TEST_EMAIL_PATTERN))

    for (const u of testUsers) {
      // Remove user first (FK to households)
      await db.delete(users).where(eq(users.id, u.id))
      // Remove household if it was created for this user
      if (u.household_id) {
        await db.delete(households).where(eq(households.id, u.household_id))
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

describe.skipIf(!process.env.DATABASE_URL)('Auth integration tests', () => {
  beforeAll(async () => {
    db = createTestDb()
    dbReachable = await checkConnection(db)
    if (!dbReachable) {
      console.warn('⚠️  DATABASE_URL is set but database is unreachable — skipping auth integration tests')
    }
  })

  afterAll(async () => {
    if (dbReachable) {
      await cleanupTestData()
    }
    if (pool) {
      await pool.end().catch(() => {})
    }
  })

  beforeEach(async ({ skip }) => {
    if (!dbReachable) skip()
    // Clean up before each test to ensure isolation
    await cleanupTestData()
  })

  // --- Registration endpoint tests ---

  it('registration creates user and household', async () => {
    const response = await callRegister({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBeDefined()
    expect(body.email).toBe(TEST_EMAIL.toLowerCase())

    // Verify user exists in DB
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1)

    expect(dbUser).toBeDefined()
    expect(dbUser.email).toBe(TEST_EMAIL.toLowerCase())
    expect(dbUser.name).toBe(TEST_NAME)
    expect(dbUser.household_id).not.toBeNull()

    // Verify household exists and owner_id matches user
    const [dbHousehold] = await db
      .select()
      .from(households)
      .where(eq(households.id, dbUser.household_id!))
      .limit(1)

    expect(dbHousehold).toBeDefined()
    expect(dbHousehold.owner_id).toBe(dbUser.id)
  })

  it('registration rejects duplicate email', async () => {
    // First registration should succeed
    const response1 = await callRegister({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    })
    expect(response1.status).toBe(201)

    // Second registration with same email should fail
    const response2 = await callRegister({
      email: TEST_EMAIL,
      password: 'DifferentPass456!',
      name: 'Another User',
    })
    expect(response2.status).toBe(409)
    const body = await response2.json()
    expect(body.error).toContain('already exists')
  })

  it('registration rejects empty body', async () => {
    const response = await callRegister({})
    expect(response.status).toBe(400)
  })

  it('registration rejects missing password', async () => {
    const response = await callRegister({
      email: 'test-auth-partial@example.com',
    })
    expect(response.status).toBe(400)
  })

  it('registration rejects missing name', async () => {
    const response = await callRegister({
      email: 'test-auth-noname@example.com',
      password: TEST_PASSWORD,
    })
    expect(response.status).toBe(400)
  })

  it('registration rejects short password (< 8 chars)', async () => {
    const response = await callRegister({
      email: 'test-auth-weak@example.com',
      password: 'short',
      name: 'Weak Pass User',
    })
    expect(response.status).toBe(400)
  })

  it('registration rejects invalid email format', async () => {
    const response = await callRegister({
      email: 'not-an-email',
      password: TEST_PASSWORD,
      name: 'Bad Email User',
    })
    expect(response.status).toBe(400)
  })

  it('password hash stored correctly in DB', async () => {
    const response = await callRegister({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    })
    expect(response.status).toBe(201)

    // Read the stored password hash
    const [dbUser] = await db
      .select({ password_hash: users.password_hash })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1)

    expect(dbUser.password_hash).toBeDefined()
    expect(dbUser.password_hash).not.toBeNull()
    // bcrypt hash format
    expect(dbUser.password_hash!).toMatch(/^\$2[ab]\$12\$/)

    // Verify the stored hash works with the original password
    const isValid = await verifyPassword(TEST_PASSWORD, dbUser.password_hash!)
    expect(isValid).toBe(true)

    // Wrong password should not verify
    const isInvalid = await verifyPassword('WrongPassword!', dbUser.password_hash!)
    expect(isInvalid).toBe(false)
  })

  // --- requireAuth export test ---

  it('requireAuth is exported from auth barrel', async () => {
    const authModule = await import('@/lib/auth')
    expect(authModule.requireAuth).toBeDefined()
    expect(typeof authModule.requireAuth).toBe('function')
  })
})
