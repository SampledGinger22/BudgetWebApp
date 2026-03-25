/**
 * Core CRUD integration tests — requires Postgres connection.
 *
 * Tests all 6 CRUD domains: settings, accounts, vendors, members,
 * categories, and dashboard. Follows the S03 household.test.ts pattern:
 * dual-driver createTestDb(), checkConnection() with graceful skip,
 * vi.mock('@/auth') with setSession/clearSession, and direct route
 * handler invocation with mock Request objects.
 *
 * Test data uses 'test-crud-' prefix for reliable LIKE-based cleanup.
 * Cleanup runs in reverse FK order in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { eq, sql, like, and, or } from 'drizzle-orm'
import * as schema from '@/db/schema'

const {
  users,
  households,
  accounts,
  appSettings,
  householdMembers,
  transactions,
  vendors,
  categories,
  categoryGroups,
} = schema

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------

const TEST_PREFIX = 'test-crud-'
const OWNER_EMAIL = `${TEST_PREFIX}owner@example.com`
const OWNER_NAME = `${TEST_PREFIX}Owner`
const OTHER_EMAIL = `${TEST_PREFIX}other@example.com`
const OTHER_NAME = `${TEST_PREFIX}Other`

type Db = ReturnType<typeof drizzle<typeof schema>> | ReturnType<typeof drizzleNeon<typeof schema>>

let db: Db
let pool: pg.Pool | null = null
let dbReachable = false

// Shared IDs set in beforeAll
let ownerId: string
let householdId: number
let otherUserId: string
let otherHouseholdId: number

// ---------------------------------------------------------------------------
// DB setup helpers (dual-driver pattern from household.test.ts)
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

function setSession(user: { id: string; email: string; name: string | null }, hId: number) {
  mockSession = {
    user: { id: user.id, email: user.email, name: user.name },
    householdId: hId,
  }
}

function clearSession() {
  mockSession = null
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function createRequest(method: string, url: string, body?: object): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost:3000${url}`, init)
}

/** Create params object matching Next.js App Router `{ params: Promise<{ id: string }> }` */
function makeParams(id: number | string) {
  return { params: Promise.resolve({ id: String(id) }) }
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

async function createTestHousehold(name: string): Promise<number> {
  const [household] = await db
    .insert(households)
    .values({ name, max_members: 5 })
    .returning()
  return household.id
}

async function createTestUser(
  email: string,
  name: string,
  hId: number,
): Promise<string> {
  const userId = crypto.randomUUID()
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name,
    household_id: hId,
  })
  return userId
}

// ---------------------------------------------------------------------------
// Cleanup — reverse FK order
// ---------------------------------------------------------------------------

async function cleanupTestData() {
  try {
    // Find test users by email pattern
    const testUsers = await db
      .select({ id: users.id, household_id: users.household_id })
      .from(users)
      .where(like(users.email, `${TEST_PREFIX}%`))

    const householdIds = new Set<number>()
    const userIds = new Set<string>()

    for (const u of testUsers) {
      userIds.add(u.id)
      if (u.household_id) householdIds.add(u.household_id)
    }

    // Delete in reverse FK order
    for (const hId of householdIds) {
      // Transactions (references accounts, members, vendors, categories)
      await db.delete(transactions).where(eq(transactions.household_id, hId))
      // App settings
      await db.delete(appSettings).where(eq(appSettings.household_id, hId))
      // Vendors (references categories)
      await db.delete(vendors).where(eq(vendors.household_id, hId))
      // Categories (sub-cats reference parent)
      await db.delete(categories).where(eq(categories.household_id, hId))
      // Category groups
      await db.delete(categoryGroups).where(eq(categoryGroups.household_id, hId))
      // Accounts
      await db.delete(accounts).where(eq(accounts.household_id, hId))
      // Household members
      await db.delete(householdMembers).where(eq(householdMembers.household_id, hId))
    }

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

describe.skipIf(!process.env.DATABASE_URL)('Core CRUD integration tests', () => {
  beforeAll(async () => {
    db = createTestDb()
    dbReachable = await checkConnection(db)
    if (!dbReachable) {
      console.warn('⚠️  DATABASE_URL is set but database is unreachable — skipping core CRUD integration tests')
      return
    }

    // Cleanup any leftovers from a previous crashed run
    await cleanupTestData()

    // Create primary test household + user
    householdId = await createTestHousehold(`${TEST_PREFIX}Budget`)
    ownerId = await createTestUser(OWNER_EMAIL, OWNER_NAME, householdId)
    await db.update(households).set({ owner_id: ownerId }).where(eq(households.id, householdId))

    // Create a second household + user for scoping tests
    otherHouseholdId = await createTestHousehold(`${TEST_PREFIX}Other Budget`)
    otherUserId = await createTestUser(OTHER_EMAIL, OTHER_NAME, otherHouseholdId)
    await db.update(households).set({ owner_id: otherUserId }).where(eq(households.id, otherHouseholdId))
  })

  afterAll(async () => {
    if (dbReachable) {
      await cleanupTestData()
    }
    if (pool) {
      await pool.end().catch(() => {})
    }
  })

  beforeEach(({ skip }) => {
    if (!dbReachable) skip()
    clearSession()
  })

  // Helper to set session for primary test user
  function loginAsOwner() {
    setSession({ id: ownerId, email: OWNER_EMAIL, name: OWNER_NAME }, householdId)
  }

  function loginAsOther() {
    setSession({ id: otherUserId, email: OTHER_EMAIL, name: OTHER_NAME }, otherHouseholdId)
  }

  // =========================================================================
  // AUTH / SCOPING
  // =========================================================================

  describe('Auth & Scoping', () => {
    it('returns 401 for unauthenticated request', async () => {
      clearSession()

      const { GET } = await import('@/app/api/settings/route')
      const req = createRequest('GET', '/api/settings?key=anything')
      try {
        await GET(req as any)
        // If requireAuth throws a Response, the route handler re-throws it
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        const res = error as Response
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error).toBe('Unauthorized')
      }
    })

    it('household scoping: data created by one household not visible to another', async () => {
      // Create an account in primary household
      loginAsOwner()
      const { POST: createAccount } = await import('@/app/api/accounts/route')
      const createReq = createRequest('POST', '/api/accounts', {
        name: `${TEST_PREFIX}scoping-test`,
        type: 'checking',
      })
      const createRes = await createAccount(createReq as any)
      expect(createRes.status).toBe(201)
      const { id: scopeAccountId } = await createRes.json()

      // Switch to other household and list accounts
      loginAsOther()
      const { GET: listAccounts } = await import('@/app/api/accounts/route')
      const listReq = createRequest('GET', '/api/accounts?includeArchived=true')
      const listRes = await listAccounts(listReq as any)
      expect(listRes.status).toBe(200)
      const otherAccounts = await listRes.json()

      // Other household should not see the primary household's account
      const found = otherAccounts.find((a: any) => a.id === scopeAccountId)
      expect(found).toBeUndefined()

      // Clean up
      loginAsOwner()
      await db.delete(accounts).where(eq(accounts.id, scopeAccountId))
    })
  })

  // =========================================================================
  // SETTINGS
  // =========================================================================

  describe('Settings', () => {
    it('GET returns null value for unknown key', async () => {
      loginAsOwner()
      const { GET } = await import('@/app/api/settings/route')
      const req = createRequest('GET', `/api/settings?key=${TEST_PREFIX}nonexistent`)
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBeNull()
    })

    it('POST upserts a new setting, GET retrieves it', async () => {
      loginAsOwner()
      const { GET, POST } = await import('@/app/api/settings/route')

      // Create
      const postReq = createRequest('POST', '/api/settings', {
        key: `${TEST_PREFIX}theme`,
        value: 'dark',
      })
      const postRes = await POST(postReq as any)
      expect(postRes.status).toBe(200)
      const postBody = await postRes.json()
      expect(postBody.key).toBe(`${TEST_PREFIX}theme`)
      expect(postBody.value).toBe('dark')

      // Retrieve
      const getReq = createRequest('GET', `/api/settings?key=${TEST_PREFIX}theme`)
      const getRes = await GET(getReq as any)
      expect(getRes.status).toBe(200)
      const getBody = await getRes.json()
      expect(getBody.value).toBe('dark')
    })

    it('POST updates existing setting (upsert)', async () => {
      loginAsOwner()
      const { GET, POST } = await import('@/app/api/settings/route')

      // Upsert first value
      const req1 = createRequest('POST', '/api/settings', {
        key: `${TEST_PREFIX}lang`,
        value: 'en',
      })
      await POST(req1 as any)

      // Update via upsert
      const req2 = createRequest('POST', '/api/settings', {
        key: `${TEST_PREFIX}lang`,
        value: 'fr',
      })
      const res2 = await POST(req2 as any)
      expect(res2.status).toBe(200)

      // Verify
      const getReq = createRequest('GET', `/api/settings?key=${TEST_PREFIX}lang`)
      const getRes = await GET(getReq as any)
      const body = await getRes.json()
      expect(body.value).toBe('fr')
    })
  })

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  describe('Accounts', () => {
    let testAccountId: number

    it('POST creates account with auto sort_order, returns id', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/accounts/route')
      const req = createRequest('POST', '/api/accounts', {
        name: `${TEST_PREFIX}Checking`,
        type: 'checking',
        opening_balance_cents: 50000,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(typeof body.id).toBe('number')
      testAccountId = body.id
    })

    it('GET lists active accounts (excludes archived)', async () => {
      loginAsOwner()
      const { GET } = await import('@/app/api/accounts/route')
      const req = createRequest('GET', '/api/accounts')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      // All returned accounts should have no archived_at
      for (const acct of body) {
        expect(acct.archived_at).toBeNull()
      }
    })

    it('GET with includeArchived=true shows all', async () => {
      loginAsOwner()

      // Create and archive an account
      const { POST: createAccount } = await import('@/app/api/accounts/route')
      const createReq = createRequest('POST', '/api/accounts', {
        name: `${TEST_PREFIX}Archived-For-List`,
        type: 'savings',
      })
      const createRes = await createAccount(createReq as any)
      const { id: archivedId } = await createRes.json()

      const { POST: archiveAccount } = await import('@/app/api/accounts/[id]/archive/route')
      const archiveReq = createRequest('POST', `/api/accounts/${archivedId}/archive`)
      await archiveAccount(archiveReq as any, makeParams(archivedId))

      // List with includeArchived
      const { GET } = await import('@/app/api/accounts/route')
      const listReq = createRequest('GET', '/api/accounts?includeArchived=true')
      const listRes = await GET(listReq as any)
      const allAccounts = await listRes.json()

      const archivedItem = allAccounts.find((a: any) => a.id === archivedId)
      expect(archivedItem).toBeDefined()
      expect(archivedItem.archived_at).not.toBeNull()

      // Clean up
      await db.delete(accounts).where(eq(accounts.id, archivedId))
    })

    it('PATCH updates name', async () => {
      loginAsOwner()
      const { PATCH } = await import('@/app/api/accounts/[id]/route')
      const req = createRequest('PATCH', `/api/accounts/${testAccountId}`, {
        name: `${TEST_PREFIX}Checking-Updated`,
      })
      const res = await PATCH(req as any, makeParams(testAccountId))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('PATCH with opening_balance_cents adjusts balance_cents delta', async () => {
      loginAsOwner()

      // Read current state
      const [before] = await db
        .select({ balance_cents: accounts.balance_cents, opening_balance_cents: accounts.opening_balance_cents })
        .from(accounts)
        .where(eq(accounts.id, testAccountId))

      // Change opening balance by +10000
      const newOpening = before.opening_balance_cents + 10000
      const { PATCH } = await import('@/app/api/accounts/[id]/route')
      const req = createRequest('PATCH', `/api/accounts/${testAccountId}`, {
        opening_balance_cents: newOpening,
      })
      const res = await PATCH(req as any, makeParams(testAccountId))
      expect(res.status).toBe(200)

      // Verify delta was applied
      const [after] = await db
        .select({ balance_cents: accounts.balance_cents, opening_balance_cents: accounts.opening_balance_cents })
        .from(accounts)
        .where(eq(accounts.id, testAccountId))

      expect(after.opening_balance_cents).toBe(newOpening)
      expect(after.balance_cents).toBe(before.balance_cents + 10000)
    })

    it('POST archive/unarchive lifecycle', async () => {
      loginAsOwner()

      // Archive
      const { POST: archiveHandler } = await import('@/app/api/accounts/[id]/archive/route')
      const archiveReq = createRequest('POST', `/api/accounts/${testAccountId}/archive`)
      const archiveRes = await archiveHandler(archiveReq as any, makeParams(testAccountId))
      expect(archiveRes.status).toBe(200)

      // Verify archived
      const [archived] = await db
        .select({ archived_at: accounts.archived_at })
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
      expect(archived.archived_at).not.toBeNull()

      // Unarchive
      const { POST: unarchiveHandler } = await import('@/app/api/accounts/[id]/unarchive/route')
      const unarchiveReq = createRequest('POST', `/api/accounts/${testAccountId}/unarchive`)
      const unarchiveRes = await unarchiveHandler(unarchiveReq as any, makeParams(testAccountId))
      expect(unarchiveRes.status).toBe(200)

      // Verify unarchived
      const [unarchived] = await db
        .select({ archived_at: accounts.archived_at })
        .from(accounts)
        .where(eq(accounts.id, testAccountId))
      expect(unarchived.archived_at).toBeNull()
    })

    it('DELETE fails on non-archived account (400), succeeds on archived', async () => {
      loginAsOwner()
      const { DELETE } = await import('@/app/api/accounts/[id]/route')

      // DELETE without archiving first → 400
      const delReq1 = createRequest('DELETE', `/api/accounts/${testAccountId}`)
      const delRes1 = await DELETE(delReq1 as any, makeParams(testAccountId))
      expect(delRes1.status).toBe(400)
      const delBody1 = await delRes1.json()
      expect(delBody1.error).toContain('archived')

      // Archive first
      const { POST: archiveHandler } = await import('@/app/api/accounts/[id]/archive/route')
      await archiveHandler(
        createRequest('POST', `/api/accounts/${testAccountId}/archive`) as any,
        makeParams(testAccountId),
      )

      // DELETE after archiving → success
      const delReq2 = createRequest('DELETE', `/api/accounts/${testAccountId}`)
      const delRes2 = await DELETE(delReq2 as any, makeParams(testAccountId))
      expect(delRes2.status).toBe(200)
      const delBody2 = await delRes2.json()
      expect(delBody2.success).toBe(true)
    })
  })

  // =========================================================================
  // VENDORS
  // =========================================================================

  describe('Vendors', () => {
    let testVendorId: number

    it('POST creates vendor, GET lists with default_category_name', async () => {
      loginAsOwner()

      // Create a category group + category to use as default_category
      const [group] = await db
        .insert(categoryGroups)
        .values({ name: `${TEST_PREFIX}vendor-group`, sort_order: 0, household_id: householdId })
        .returning()
      const [cat] = await db
        .insert(categories)
        .values({
          category_group_id: group.id,
          name: `${TEST_PREFIX}vendor-cat`,
          ref_number: `${TEST_PREFIX}vc1`,
          sort_order: 0,
          household_id: householdId,
        })
        .returning()

      // Create vendor with default_category_id
      const { POST } = await import('@/app/api/vendors/route')
      const createReq = createRequest('POST', '/api/vendors', {
        name: `${TEST_PREFIX}Grocery Store`,
        default_category_id: cat.id,
      })
      const createRes = await POST(createReq as any)
      expect(createRes.status).toBe(201)
      const { id } = await createRes.json()
      testVendorId = id

      // GET list should include default_category_name via LEFT JOIN
      const { GET } = await import('@/app/api/vendors/route')
      const listReq = createRequest('GET', '/api/vendors')
      const listRes = await GET(listReq as any)
      expect(listRes.status).toBe(200)
      const vendorList = await listRes.json()
      const testVendor = vendorList.find((v: any) => v.id === testVendorId)
      expect(testVendor).toBeDefined()
      expect(testVendor.default_category_name).toBe(`${TEST_PREFIX}vendor-cat`)

      // Clean up category data (vendor cleanup happens below)
      await db.delete(categories).where(eq(categories.id, cat.id))
      await db.delete(categoryGroups).where(eq(categoryGroups.id, group.id))
    })

    it('PATCH updates vendor', async () => {
      loginAsOwner()
      const { PATCH } = await import('@/app/api/vendors/[id]/route')
      const req = createRequest('PATCH', `/api/vendors/${testVendorId}`, {
        name: `${TEST_PREFIX}Updated Store`,
      })
      const res = await PATCH(req as any, makeParams(testVendorId))
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it('DELETE fails on non-archived vendor (400)', async () => {
      loginAsOwner()
      const { DELETE } = await import('@/app/api/vendors/[id]/route')
      const req = createRequest('DELETE', `/api/vendors/${testVendorId}`)
      const res = await DELETE(req as any, makeParams(testVendorId))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('archived')
    })

    it('POST archive, DELETE succeeds on archived vendor', async () => {
      loginAsOwner()

      // Archive
      const { POST: archiveVendor } = await import('@/app/api/vendors/[id]/archive/route')
      const archiveRes = await archiveVendor(
        createRequest('POST', `/api/vendors/${testVendorId}/archive`) as any,
        makeParams(testVendorId),
      )
      expect(archiveRes.status).toBe(200)

      // DELETE succeeds
      const { DELETE } = await import('@/app/api/vendors/[id]/route')
      const delReq = createRequest('DELETE', `/api/vendors/${testVendorId}`)
      const delRes = await DELETE(delReq as any, makeParams(testVendorId))
      expect(delRes.status).toBe(200)
      expect((await delRes.json()).success).toBe(true)
    })
  })

  // =========================================================================
  // MEMBERS
  // =========================================================================

  describe('Members', () => {
    let testMemberId: number
    let testMemberId2: number

    it('POST creates member with auto sort_order', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/members/route')
      const req = createRequest('POST', '/api/members', {
        name: `${TEST_PREFIX}Alice`,
        initials: 'AL',
        color: '#ff0000',
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      testMemberId = body.id

      // Create second member for reorder test
      const req2 = createRequest('POST', '/api/members', {
        name: `${TEST_PREFIX}Bob`,
        initials: 'BO',
        color: '#00ff00',
      })
      const res2 = await POST(req2 as any)
      expect(res2.status).toBe(201)
      testMemberId2 = (await res2.json()).id
    })

    it('PATCH updates member fields', async () => {
      loginAsOwner()
      const { PATCH } = await import('@/app/api/members/[id]/route')
      const req = createRequest('PATCH', `/api/members/${testMemberId}`, {
        name: `${TEST_PREFIX}Alice-Updated`,
        color: '#0000ff',
      })
      const res = await PATCH(req as any, makeParams(testMemberId))
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it('POST archive, POST unarchive lifecycle', async () => {
      loginAsOwner()

      // Archive
      const { POST: archiveMember } = await import('@/app/api/members/[id]/archive/route')
      const archiveRes = await archiveMember(
        createRequest('POST', `/api/members/${testMemberId}/archive`) as any,
        makeParams(testMemberId),
      )
      expect(archiveRes.status).toBe(200)

      // Verify archived — not in default list
      const { GET } = await import('@/app/api/members/route')
      const listReq = createRequest('GET', '/api/members')
      const listRes = await GET(listReq as any)
      const list = await listRes.json()
      expect(list.find((m: any) => m.id === testMemberId)).toBeUndefined()

      // Unarchive
      const { POST: unarchiveMember } = await import('@/app/api/members/[id]/unarchive/route')
      const unarchiveRes = await unarchiveMember(
        createRequest('POST', `/api/members/${testMemberId}/unarchive`) as any,
        makeParams(testMemberId),
      )
      expect(unarchiveRes.status).toBe(200)

      // Verify unarchived — back in default list
      const listReq2 = createRequest('GET', '/api/members')
      const listRes2 = await GET(listReq2 as any)
      const list2 = await listRes2.json()
      expect(list2.find((m: any) => m.id === testMemberId)).toBeDefined()
    })

    it('DELETE returns 409 when member has transaction references', async () => {
      loginAsOwner()

      // Create an account for the transaction
      const [acct] = await db
        .insert(accounts)
        .values({
          name: `${TEST_PREFIX}txn-acct`,
          type: 'checking',
          balance_cents: 0,
          opening_balance_cents: 0,
          sort_order: 99,
          household_id: householdId,
        })
        .returning()

      // Create a transaction referencing the member
      const [txn] = await db
        .insert(transactions)
        .values({
          account_id: acct.id,
          date: '2025-01-01',
          description: `${TEST_PREFIX}txn`,
          original_description: `${TEST_PREFIX}txn`,
          amount_cents: 1000,
          is_debit: 1,
          member_id: testMemberId,
          household_id: householdId,
        })
        .returning()

      // Attempt delete → 409
      const { DELETE } = await import('@/app/api/members/[id]/route')
      const delReq = createRequest('DELETE', `/api/members/${testMemberId}`)
      const delRes = await DELETE(delReq as any, makeParams(testMemberId))
      expect(delRes.status).toBe(409)
      const body = await delRes.json()
      expect(body.error).toContain('transactions')
      expect(body.transaction_count).toBeGreaterThan(0)

      // Clean up txn + acct
      await db.delete(transactions).where(eq(transactions.id, txn.id))
      await db.delete(accounts).where(eq(accounts.id, acct.id))
    })

    it('DELETE succeeds when no transaction references', async () => {
      loginAsOwner()

      // Create a throwaway member
      const { POST } = await import('@/app/api/members/route')
      const createReq = createRequest('POST', '/api/members', {
        name: `${TEST_PREFIX}Disposable`,
        initials: 'DI',
        color: '#999999',
      })
      const createRes = await POST(createReq as any)
      const { id: disposableId } = await createRes.json()

      // Delete should succeed (no transactions)
      const { DELETE } = await import('@/app/api/members/[id]/route')
      const delReq = createRequest('DELETE', `/api/members/${disposableId}`)
      const delRes = await DELETE(delReq as any, makeParams(disposableId))
      expect(delRes.status).toBe(200)
      expect((await delRes.json()).success).toBe(true)
    })

    it('POST reorder changes sort_order', async () => {
      loginAsOwner()

      // Current order: testMemberId (sort 0), testMemberId2 (sort 1) — reverse it
      const { POST: reorder } = await import('@/app/api/members/reorder/route')
      const req = createRequest('POST', '/api/members/reorder', {
        ids: [testMemberId2, testMemberId],
      })
      const res = await reorder(req as any)
      expect(res.status).toBe(200)

      // Verify new order
      const { GET } = await import('@/app/api/members/route')
      const listReq = createRequest('GET', '/api/members')
      const listRes = await GET(listReq as any)
      const list = await listRes.json()
      const m1 = list.find((m: any) => m.id === testMemberId)
      const m2 = list.find((m: any) => m.id === testMemberId2)
      expect(m2.sort_order).toBeLessThan(m1.sort_order)
    })
  })

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  describe('Categories', () => {
    let testGroupId: number
    let testCategoryId: number
    let testSubCategoryId: number

    it('POST createGroup succeeds', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/categories/groups/route')
      const req = createRequest('POST', '/api/categories/groups', {
        name: `${TEST_PREFIX}Group 1`,
        color: '#aabbcc',
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      testGroupId = body.id
    })

    it('POST createGroup enforces max 5 limit', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/categories/groups/route')

      // Create groups 2-5
      const additionalGroupIds: number[] = []
      for (let i = 2; i <= 5; i++) {
        const req = createRequest('POST', '/api/categories/groups', {
          name: `${TEST_PREFIX}Group ${i}`,
        })
        const res = await POST(req as any)
        expect(res.status).toBe(201)
        additionalGroupIds.push((await res.json()).id)
      }

      // Attempt 6th → 409
      const req6 = createRequest('POST', '/api/categories/groups', {
        name: `${TEST_PREFIX}Group 6`,
      })
      const res6 = await POST(req6 as any)
      expect(res6.status).toBe(409)
      const body = await res6.json()
      expect(body.error).toContain('Maximum')

      // Clean up extras (keep testGroupId for subsequent tests)
      for (const gId of additionalGroupIds) {
        await db.delete(categoryGroups).where(eq(categoryGroups.id, gId))
      }
    })

    it('POST create category with auto ref_number', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/categories/route')
      const req = createRequest('POST', '/api/categories', {
        category_group_id: testGroupId,
        name: `${TEST_PREFIX}Groceries`,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(body.ref_number).toBeDefined()
      testCategoryId = body.id

      // Create a sub-category
      const subReq = createRequest('POST', '/api/categories', {
        category_group_id: testGroupId,
        parent_id: testCategoryId,
        name: `${TEST_PREFIX}Fresh Produce`,
      })
      const subRes = await POST(subReq as any)
      expect(subRes.status).toBe(201)
      testSubCategoryId = (await subRes.json()).id
    })

    it('GET list returns nested group → category → sub-category structure', async () => {
      loginAsOwner()
      const { GET } = await import('@/app/api/categories/route')
      const req = createRequest('GET', '/api/categories')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const groups = await res.json()
      expect(Array.isArray(groups)).toBe(true)

      // Find our test group
      const testGroup = groups.find((g: any) => g.id === testGroupId)
      expect(testGroup).toBeDefined()
      expect(testGroup.categories.length).toBeGreaterThanOrEqual(1)

      const testCat = testGroup.categories.find((c: any) => c.id === testCategoryId)
      expect(testCat).toBeDefined()
      expect(testCat.sub_categories.length).toBeGreaterThanOrEqual(1)
      expect(testCat.sub_categories[0].id).toBe(testSubCategoryId)
    })

    it('PATCH updates category name', async () => {
      loginAsOwner()
      const { PATCH } = await import('@/app/api/categories/[id]/route')
      const req = createRequest('PATCH', `/api/categories/${testCategoryId}`, {
        name: `${TEST_PREFIX}Groceries-Updated`,
      })
      const res = await PATCH(req as any, makeParams(testCategoryId))
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    it('POST archive cascades to sub-categories', async () => {
      loginAsOwner()
      const { POST: archiveCategory } = await import('@/app/api/categories/[id]/archive/route')
      const req = createRequest('POST', `/api/categories/${testCategoryId}/archive`)
      const res = await archiveCategory(req as any, makeParams(testCategoryId))
      expect(res.status).toBe(200)

      // Verify parent and sub-category are both archived
      const [parent] = await db
        .select({ archived_at: categories.archived_at })
        .from(categories)
        .where(eq(categories.id, testCategoryId))
      expect(parent.archived_at).not.toBeNull()

      const [sub] = await db
        .select({ archived_at: categories.archived_at })
        .from(categories)
        .where(eq(categories.id, testSubCategoryId))
      expect(sub.archived_at).not.toBeNull()
    })

    it('DELETE cascades to sub-categories', async () => {
      loginAsOwner()

      // First unarchive so we can see both exist, then delete
      // (DELETE doesn't require archived state for categories — unlike accounts/vendors)
      const { DELETE: deleteCategory } = await import('@/app/api/categories/[id]/route')
      const req = createRequest('DELETE', `/api/categories/${testCategoryId}`)
      const res = await deleteCategory(req as any, makeParams(testCategoryId))
      expect(res.status).toBe(200)

      // Verify both parent and sub-category are gone
      const remaining = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          or(
            eq(categories.id, testCategoryId),
            eq(categories.id, testSubCategoryId),
          ),
        )
      expect(remaining).toHaveLength(0)
    })
  })

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  describe('Dashboard', () => {
    it('GET returns account summaries with totals', async () => {
      loginAsOwner()

      // Create a couple of accounts for the dashboard
      const [checkingAcct] = await db
        .insert(accounts)
        .values({
          name: `${TEST_PREFIX}Dashboard Checking`,
          type: 'checking',
          balance_cents: 100000,
          opening_balance_cents: 100000,
          sort_order: 0,
          household_id: householdId,
        })
        .returning()

      const [savingsAcct] = await db
        .insert(accounts)
        .values({
          name: `${TEST_PREFIX}Dashboard Savings`,
          type: 'savings',
          balance_cents: 250000,
          opening_balance_cents: 250000,
          sort_order: 1,
          household_id: householdId,
        })
        .returning()

      const { GET } = await import('@/app/api/dashboard/route')
      const req = createRequest('GET', '/api/dashboard')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()

      // Structure checks
      expect(body.accounts).toBeDefined()
      expect(Array.isArray(body.accounts)).toBe(true)
      expect(body.totals).toBeDefined()
      expect(typeof body.totals.checking).toBe('number')
      expect(typeof body.totals.savings).toBe('number')
      expect(typeof body.totals.net).toBe('number')

      // Totals should include our test accounts
      expect(body.totals.checking).toBeGreaterThanOrEqual(100000)
      expect(body.totals.savings).toBeGreaterThanOrEqual(250000)

      // Clean up
      await db.delete(accounts).where(eq(accounts.id, checkingAcct.id))
      await db.delete(accounts).where(eq(accounts.id, savingsAcct.id))
    })
  })
})
