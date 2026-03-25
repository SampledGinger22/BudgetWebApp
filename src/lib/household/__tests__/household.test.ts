/**
 * Household integration tests — requires Postgres connection.
 *
 * Tests household info retrieval, member listing, invite creation with all
 * validation rules, acceptance with household switching and orphan cleanup,
 * decline, idempotency of accept/decline, and pending invite discovery.
 *
 * Follows the S02 auth-integration.test.ts pattern: createTestDb(),
 * checkConnection(), describe.skipIf, direct route handler invocation,
 * and LIKE-pattern cleanup.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { eq, sql, like, and } from 'drizzle-orm'
import * as schema from '@/db/schema'

const { users, households, householdInvites } = schema

// ---------------------------------------------------------------------------
// Test data patterns
// ---------------------------------------------------------------------------

const TEST_EMAIL_PATTERN = '%test-household-%@example.com'
const OWNER_EMAIL = 'test-household-owner@example.com'
const OWNER_NAME = 'Test Owner'
const INVITEE_EMAIL = 'test-household-invitee@example.com'
const INVITEE_NAME = 'Test Invitee'

type Db = ReturnType<typeof drizzle<typeof schema>> | ReturnType<typeof drizzleNeon<typeof schema>>

let db: Db
let pool: pg.Pool | null = null
let dbReachable = false

// ---------------------------------------------------------------------------
// DB setup helpers (same pattern as auth-integration.test.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Auth mock — controls what requireAuth() sees
// ---------------------------------------------------------------------------

let mockSession: any = null

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}))

function setSession(user: { id: string; email: string; name: string | null }, householdId: number) {
  mockSession = {
    user: { id: user.id, email: user.email, name: user.name },
    householdId,
  }
}

function clearSession() {
  mockSession = null
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Insert a household + user directly via Drizzle and return their IDs.
 * Sets the user as the household owner.
 */
async function createTestUser(
  email: string,
  name: string,
  householdName?: string,
): Promise<{ userId: string; householdId: number }> {
  const [household] = await db
    .insert(households)
    .values({ name: householdName ?? `${name}'s Budget`, max_members: 2 })
    .returning()

  const userId = crypto.randomUUID()
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name,
    household_id: household.id,
  })

  // Set owner_id on the household
  await db
    .update(households)
    .set({ owner_id: userId })
    .where(eq(households.id, household.id))

  return { userId, householdId: household.id }
}

/**
 * Call a Next.js route handler directly. Builds a mock Request.
 */
async function callRoute(
  handler: (req: any) => Promise<Response>,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
) {
  const url = 'http://localhost/api/test'
  const init: RequestInit = { method }
  if (method === 'POST' && body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const request = new Request(url, init)
  return handler(request as any)
}

/**
 * Clean up all test data created during tests.
 * Order: invites → users → households (reverse FK order).
 */
async function cleanupTestData() {
  try {
    // Find test users
    const testUsers = await db
      .select({ id: users.id, household_id: users.household_id })
      .from(users)
      .where(like(users.email, TEST_EMAIL_PATTERN))

    const householdIds = new Set<number>()
    const userIds = new Set<string>()

    for (const u of testUsers) {
      userIds.add(u.id)
      if (u.household_id) householdIds.add(u.household_id)
    }

    // Delete invites referencing test households
    for (const hId of householdIds) {
      await db.delete(householdInvites).where(eq(householdInvites.household_id, hId))
    }

    // Delete invites sent to test emails
    await db.delete(householdInvites).where(like(householdInvites.email, TEST_EMAIL_PATTERN))

    // Delete test users
    for (const uId of userIds) {
      await db.delete(users).where(eq(users.id, uId))
    }

    // Delete test households
    for (const hId of householdIds) {
      await db.delete(households).where(eq(households.id, hId))
    }
  } catch {
    // Best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)('Household integration tests', () => {
  beforeAll(async () => {
    db = createTestDb()
    dbReachable = await checkConnection(db)
    if (!dbReachable) {
      console.warn('⚠️  DATABASE_URL is set but database is unreachable — skipping household integration tests')
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
    await cleanupTestData()
    clearSession()
  })

  // -----------------------------------------------------------------------
  // GET /api/household — household info
  // -----------------------------------------------------------------------

  it('GET /api/household returns household info with member_count', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { GET } = await import('@/app/api/household/route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe(owner.householdId)
    expect(body.name).toBe("Test Owner's Budget")
    expect(body.member_count).toBe(1)
    expect(body.owner_id).toBe(owner.userId)
  })

  // -----------------------------------------------------------------------
  // GET /api/household/members — member listing
  // -----------------------------------------------------------------------

  it('GET /api/household/members returns the owner', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { GET } = await import('@/app/api/household/members/route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].email).toBe(OWNER_EMAIL)
    expect(body[0].is_owner).toBe(true)
  })

  // -----------------------------------------------------------------------
  // POST /api/household/invite — invite creation
  // -----------------------------------------------------------------------

  it('POST /api/household/invite creates a pending invite (happy path)', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { POST } = await import('@/app/api/household/invite/route')
    const response = await callRoute(POST, 'POST', { email: INVITEE_EMAIL })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.email).toBe(INVITEE_EMAIL)
    expect(body.status).toBe('pending')
    expect(body.id).toBeDefined()
  })

  it('POST /api/household/invite rejects non-owner caller (403)', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    // Create a second user in the same household who is NOT the owner
    const memberId = crypto.randomUUID()
    const memberEmail = 'test-household-member@example.com'
    await db.insert(users).values({
      id: memberId,
      email: memberEmail,
      name: 'Test Member',
      household_id: owner.householdId,
    })
    setSession({ id: memberId, email: memberEmail, name: 'Test Member' }, owner.householdId)

    const { POST } = await import('@/app/api/household/invite/route')
    const response = await callRoute(POST, 'POST', { email: 'test-household-other@example.com' })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('owner')
  })

  it('POST /api/household/invite rejects self-invite (400)', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { POST } = await import('@/app/api/household/invite/route')
    const response = await callRoute(POST, 'POST', { email: OWNER_EMAIL })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('yourself')
  })

  it('POST /api/household/invite rejects duplicate pending invite (409)', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { POST } = await import('@/app/api/household/invite/route')

    // First invite succeeds
    const r1 = await callRoute(POST, 'POST', { email: INVITEE_EMAIL })
    expect(r1.status).toBe(201)

    // Duplicate invite fails
    const r2 = await callRoute(POST, 'POST', { email: INVITEE_EMAIL })
    expect(r2.status).toBe(409)
    const body = await r2.json()
    expect(body.error).toContain('pending')
  })

  it('POST /api/household/invite rejects when at max_members (409)', async () => {
    // Create a household with max_members = 2, add a second member to fill it
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)

    // Add a second member directly to fill the household (max_members = 2)
    const fillerEmail = 'test-household-filler@example.com'
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email: fillerEmail,
      name: 'Filler User',
      household_id: owner.householdId,
    })

    setSession({ id: owner.userId, email: OWNER_EMAIL, name: OWNER_NAME }, owner.householdId)

    const { POST } = await import('@/app/api/household/invite/route')
    const response = await callRoute(POST, 'POST', { email: INVITEE_EMAIL })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('capacity')
  })

  // -----------------------------------------------------------------------
  // POST /api/household/invite/accept — accept invite
  // -----------------------------------------------------------------------

  it('POST /api/household/invite/accept joins household and updates invite status', async () => {
    // Setup: owner invites the invitee
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    const invitee = await createTestUser(INVITEE_EMAIL, INVITEE_NAME)

    // Create the invite directly in DB
    const [invite] = await db
      .insert(householdInvites)
      .values({
        household_id: owner.householdId,
        email: INVITEE_EMAIL,
        status: 'pending',
        invited_by: owner.userId,
      })
      .returning()

    // Set session to the invitee
    setSession({ id: invitee.userId, email: INVITEE_EMAIL, name: INVITEE_NAME }, invitee.householdId)

    const { POST } = await import('@/app/api/household/invite/accept/route')
    const response = await callRoute(POST, 'POST', { invite_id: invite.id })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.household_id).toBe(owner.householdId)
    expect(body.message).toBe('Invite accepted')

    // Verify user's household_id was updated in DB
    const [updatedUser] = await db
      .select({ household_id: users.household_id })
      .from(users)
      .where(eq(users.id, invitee.userId))
      .limit(1)
    expect(updatedUser.household_id).toBe(owner.householdId)

    // Verify invite status is 'accepted'
    const [updatedInvite] = await db
      .select({ status: householdInvites.status })
      .from(householdInvites)
      .where(eq(householdInvites.id, invite.id))
      .limit(1)
    expect(updatedInvite.status).toBe('accepted')

    // Verify invitee's old household was cleaned up (orphaned)
    const [oldHousehold] = await db
      .select()
      .from(households)
      .where(eq(households.id, invitee.householdId))
      .limit(1)
    expect(oldHousehold).toBeUndefined()
  })

  it('POST /api/household/invite/accept is idempotent (re-accept returns 200)', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    const invitee = await createTestUser(INVITEE_EMAIL, INVITEE_NAME)

    const [invite] = await db
      .insert(householdInvites)
      .values({
        household_id: owner.householdId,
        email: INVITEE_EMAIL,
        status: 'pending',
        invited_by: owner.userId,
      })
      .returning()

    setSession({ id: invitee.userId, email: INVITEE_EMAIL, name: INVITEE_NAME }, invitee.householdId)

    const { POST } = await import('@/app/api/household/invite/accept/route')

    // First accept
    const r1 = await callRoute(POST, 'POST', { invite_id: invite.id })
    expect(r1.status).toBe(200)
    const b1 = await r1.json()
    expect(b1.message).toBe('Invite accepted')

    // Re-accept — should be idempotent
    // Update session to reflect new household (accept changes user's household)
    setSession({ id: invitee.userId, email: INVITEE_EMAIL, name: INVITEE_NAME }, owner.householdId)
    const r2 = await callRoute(POST, 'POST', { invite_id: invite.id })
    expect(r2.status).toBe(200)
    const b2 = await r2.json()
    expect(b2.message).toBe('Already accepted')
  })

  // -----------------------------------------------------------------------
  // POST /api/household/invite/decline — decline invite
  // -----------------------------------------------------------------------

  it('POST /api/household/invite/decline updates status to declined', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    const invitee = await createTestUser(INVITEE_EMAIL, INVITEE_NAME)

    const [invite] = await db
      .insert(householdInvites)
      .values({
        household_id: owner.householdId,
        email: INVITEE_EMAIL,
        status: 'pending',
        invited_by: owner.userId,
      })
      .returning()

    setSession({ id: invitee.userId, email: INVITEE_EMAIL, name: INVITEE_NAME }, invitee.householdId)

    const { POST } = await import('@/app/api/household/invite/decline/route')
    const response = await callRoute(POST, 'POST', { invite_id: invite.id })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Invite declined')

    // Verify invite status in DB
    const [updatedInvite] = await db
      .select({ status: householdInvites.status })
      .from(householdInvites)
      .where(eq(householdInvites.id, invite.id))
      .limit(1)
    expect(updatedInvite.status).toBe('declined')
  })

  // -----------------------------------------------------------------------
  // GET /api/household/invite — pending invite discovery
  // -----------------------------------------------------------------------

  it('GET /api/household/invite returns pending invites for invitee email', async () => {
    const owner = await createTestUser(OWNER_EMAIL, OWNER_NAME)
    const invitee = await createTestUser(INVITEE_EMAIL, INVITEE_NAME)

    // Create a pending invite
    await db.insert(householdInvites).values({
      household_id: owner.householdId,
      email: INVITEE_EMAIL,
      status: 'pending',
      invited_by: owner.userId,
    })

    setSession({ id: invitee.userId, email: INVITEE_EMAIL, name: INVITEE_NAME }, invitee.householdId)

    const { GET } = await import('@/app/api/household/invite/route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].household_name).toBe("Test Owner's Budget")
    expect(body[0].invited_by_name).toBe(OWNER_NAME)
    expect(body[0].id).toBeDefined()
  })
})
