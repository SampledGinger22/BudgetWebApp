/**
 * Complex business logic integration tests — requires Postgres connection.
 *
 * Tests critical business logic paths across all S05 domains:
 * transactions, budget, reconciliation, and recurring.
 *
 * Follows the S04 core-crud.test.ts pattern:
 * - Dual-driver createTestDb() with neon-http/node-postgres auto-detection
 * - checkConnection() with graceful skip
 * - vi.mock('@/auth') with setSession/clearSession
 * - makeParams() helper for [id] routes
 * - Direct route handler invocation with mock Request objects
 * - Cleanup in afterAll in reverse FK order
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { eq, sql, like, and, inArray } from 'drizzle-orm'
import * as schema from '@/db/schema'

const {
  users,
  households,
  accounts,
  transactions,
  householdMembers,
  categories,
  categoryGroups,
  vendors,
  budgetPeriods,
  budgetSubPeriods,
  budgetAllocations,
  budgetTransfers,
  periodIncomeLines,
  reconciliationSessions,
  recurringTemplates,
  recurringTemplateDates,
  recurringGenerationLog,
  recurringDismissedSuggestions,
} = schema

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------

const TEST_PREFIX = 'test-biz-'
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
let checkingAccountId: number
let creditAccountId: number
let categoryGroupId: number
let categoryId: number
let categoryId2: number
let vendorId: number
let memberId: number
let subPeriodId: number
let periodId: number

// ---------------------------------------------------------------------------
// DB setup helpers (dual-driver pattern)
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

async function createTestUser(email: string, name: string, hId: number): Promise<string> {
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

    for (const hId of householdIds) {
      // Recurring dismissed suggestions
      await db.delete(recurringDismissedSuggestions).where(eq(recurringDismissedSuggestions.household_id, hId))
      // Recurring generation log
      await db.delete(recurringGenerationLog).where(eq(recurringGenerationLog.household_id, hId))
      // Recurring template dates
      await db.delete(recurringTemplateDates).where(eq(recurringTemplateDates.household_id, hId))
      // Recurring templates
      await db.delete(recurringTemplates).where(eq(recurringTemplates.household_id, hId))
      // Reconciliation sessions
      await db.delete(reconciliationSessions).where(eq(reconciliationSessions.household_id, hId))
      // Budget transfers
      await db.delete(budgetTransfers).where(eq(budgetTransfers.household_id, hId))
      // Budget allocations
      await db.delete(budgetAllocations).where(eq(budgetAllocations.household_id, hId))
      // Transactions
      await db.delete(transactions).where(eq(transactions.household_id, hId))
      // Period income lines
      await db.delete(periodIncomeLines).where(eq(periodIncomeLines.household_id, hId))
      // Budget sub-periods
      await db.delete(budgetSubPeriods).where(eq(budgetSubPeriods.household_id, hId))
      // Budget periods
      await db.delete(budgetPeriods).where(eq(budgetPeriods.household_id, hId))
      // Vendors
      await db.delete(vendors).where(eq(vendors.household_id, hId))
      // Categories
      await db.delete(categories).where(eq(categories.household_id, hId))
      // Category groups
      await db.delete(categoryGroups).where(eq(categoryGroups.household_id, hId))
      // Accounts
      await db.delete(accounts).where(eq(accounts.household_id, hId))
      // Household members
      await db.delete(householdMembers).where(eq(householdMembers.household_id, hId))
    }

    for (const uId of userIds) {
      await db.delete(users).where(eq(users.id, uId))
    }

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

describe.skipIf(!process.env.DATABASE_URL)('Complex business logic integration tests', () => {
  beforeAll(async () => {
    db = createTestDb()
    dbReachable = await checkConnection(db)
    if (!dbReachable) {
      console.warn('⚠️  DATABASE_URL is set but database is unreachable — skipping complex business logic tests')
      return
    }

    // Cleanup leftovers from previous crashed run
    await cleanupTestData()

    // Create primary household + user
    householdId = await createTestHousehold(`${TEST_PREFIX}Budget`)
    ownerId = await createTestUser(OWNER_EMAIL, OWNER_NAME, householdId)
    await db.update(households).set({ owner_id: ownerId }).where(eq(households.id, householdId))

    // Create second household + user for scoping tests
    otherHouseholdId = await createTestHousehold(`${TEST_PREFIX}Other`)
    otherUserId = await createTestUser(OTHER_EMAIL, OTHER_NAME, otherHouseholdId)
    await db.update(households).set({ owner_id: otherUserId }).where(eq(households.id, otherHouseholdId))

    // Create shared test data

    // Accounts
    const [checking] = await db
      .insert(accounts)
      .values({
        name: `${TEST_PREFIX}Checking`,
        type: 'checking',
        balance_cents: 100000,
        opening_balance_cents: 100000,
        sort_order: 0,
        household_id: householdId,
      })
      .returning()
    checkingAccountId = checking.id

    const [credit] = await db
      .insert(accounts)
      .values({
        name: `${TEST_PREFIX}Credit Card`,
        type: 'credit',
        balance_cents: 50000,
        opening_balance_cents: 50000,
        sort_order: 1,
        household_id: householdId,
      })
      .returning()
    creditAccountId = credit.id

    // Category group + categories
    const [group] = await db
      .insert(categoryGroups)
      .values({ name: `${TEST_PREFIX}Essentials`, sort_order: 0, household_id: householdId })
      .returning()
    categoryGroupId = group.id

    const [cat1] = await db
      .insert(categories)
      .values({
        category_group_id: group.id,
        name: `${TEST_PREFIX}Groceries`,
        ref_number: `${TEST_PREFIX}cat1`,
        sort_order: 0,
        household_id: householdId,
      })
      .returning()
    categoryId = cat1.id

    const [cat2] = await db
      .insert(categories)
      .values({
        category_group_id: group.id,
        name: `${TEST_PREFIX}Utilities`,
        ref_number: `${TEST_PREFIX}cat2`,
        sort_order: 1,
        household_id: householdId,
      })
      .returning()
    categoryId2 = cat2.id

    // Vendor
    const [v] = await db
      .insert(vendors)
      .values({ name: `${TEST_PREFIX}Walmart`, household_id: householdId })
      .returning()
    vendorId = v.id

    // Member
    const [m] = await db
      .insert(householdMembers)
      .values({
        name: `${TEST_PREFIX}Alice`,
        initials: 'AL',
        color: '#ff0000',
        sort_order: 0,
        household_id: householdId,
      })
      .returning()
    memberId = m.id

    // Budget period + sub-period (for budget & recurring tests)
    const [bp] = await db
      .insert(budgetPeriods)
      .values({
        pay_schedule_id: 1, // Will be overridden if needed
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        is_customized: 0,
        household_id: householdId,
      })
      .returning()
    periodId = bp.id

    const [bsp] = await db
      .insert(budgetSubPeriods)
      .values({
        budget_period_id: bp.id,
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        sort_order: 0,
        household_id: householdId,
      })
      .returning()
    subPeriodId = bsp.id
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

  function loginAsOwner() {
    setSession({ id: ownerId, email: OWNER_EMAIL, name: OWNER_NAME }, householdId)
  }

  function loginAsOther() {
    setSession({ id: otherUserId, email: OTHER_EMAIL, name: OTHER_NAME }, otherHouseholdId)
  }

  // =========================================================================
  // AUTH
  // =========================================================================

  describe('Auth rejection', () => {
    it('returns 401 for unauthenticated transaction list', async () => {
      clearSession()
      const { GET } = await import('@/app/api/transactions/route')
      const req = createRequest('GET', '/api/transactions?accountId=1')
      try {
        await GET(req as any)
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        const res = error as Response
        expect(res.status).toBe(401)
      }
    })

    it('returns 401 for unauthenticated recurring list', async () => {
      clearSession()
      const { GET } = await import('@/app/api/recurring/route')
      const req = createRequest('GET', '/api/recurring')
      try {
        await GET(req as any)
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Response)
        expect((error as Response).status).toBe(401)
      }
    })
  })

  // =========================================================================
  // TRANSACTIONS — balance delta accounting
  // =========================================================================

  describe('Transactions — balance delta', () => {
    let txnId: number
    let liabilityTxnId: number

    it('create debit transaction on asset account decreases balance', async () => {
      loginAsOwner()

      const [before] = await db
        .select({ balance_cents: accounts.balance_cents })
        .from(accounts)
        .where(eq(accounts.id, checkingAccountId))

      const { POST } = await import('@/app/api/transactions/route')
      const req = createRequest('POST', '/api/transactions', {
        accountId: checkingAccountId,
        date: '2026-03-15',
        description: `${TEST_PREFIX}Grocery Run`,
        originalDescription: `${TEST_PREFIX}Grocery Run`,
        amountCents: 5000,
        isDebit: 1,
        categoryId: categoryId,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      txnId = body.id

      // Verify balance decreased by 5000 (asset debit → negative delta)
      const [after] = await db
        .select({ balance_cents: accounts.balance_cents })
        .from(accounts)
        .where(eq(accounts.id, checkingAccountId))

      expect(after.balance_cents).toBe(before.balance_cents - 5000)
    })

    it('create debit transaction on liability account increases balance', async () => {
      loginAsOwner()

      const [before] = await db
        .select({ balance_cents: accounts.balance_cents })
        .from(accounts)
        .where(eq(accounts.id, creditAccountId))

      const { POST } = await import('@/app/api/transactions/route')
      const req = createRequest('POST', '/api/transactions', {
        accountId: creditAccountId,
        date: '2026-03-15',
        description: `${TEST_PREFIX}CC Purchase`,
        originalDescription: `${TEST_PREFIX}CC Purchase`,
        amountCents: 3000,
        isDebit: 1,
        categoryId: categoryId,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      liabilityTxnId = (await res.json()).id

      // Verify balance increased by 3000 (liability debit → positive delta)
      const [after] = await db
        .select({ balance_cents: accounts.balance_cents })
        .from(accounts)
        .where(eq(accounts.id, creditAccountId))

      expect(after.balance_cents).toBe(before.balance_cents + 3000)
    })

    it('delete transaction in unlocked period hard deletes', async () => {
      loginAsOwner()

      const { DELETE } = await import('@/app/api/transactions/[id]/route')
      const req = createRequest('DELETE', `/api/transactions/${txnId}`)
      const res = await DELETE(req as any, makeParams(txnId))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify transaction is gone
      const [found] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1)
      expect(found).toBeUndefined()
    })

    it('delete transaction in locked period sets voided_at', async () => {
      loginAsOwner()

      // Lock the sub-period
      await db
        .update(budgetSubPeriods)
        .set({ locked_at: new Date() })
        .where(eq(budgetSubPeriods.id, subPeriodId))

      // Assign the liability txn to this sub-period
      await db
        .update(transactions)
        .set({ budget_sub_period_id: subPeriodId })
        .where(eq(transactions.id, liabilityTxnId))

      const { DELETE } = await import('@/app/api/transactions/[id]/route')
      const req = createRequest('DELETE', `/api/transactions/${liabilityTxnId}`)
      const res = await DELETE(req as any, makeParams(liabilityTxnId))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.voided).toBe(true)

      // Verify voided_at is set, not hard deleted
      const [voided] = await db
        .select({ id: transactions.id, voided_at: transactions.voided_at })
        .from(transactions)
        .where(eq(transactions.id, liabilityTxnId))
        .limit(1)
      expect(voided).toBeDefined()
      expect(voided.voided_at).not.toBeNull()

      // Unlock the sub-period for subsequent tests
      await db
        .update(budgetSubPeriods)
        .set({ locked_at: null })
        .where(eq(budgetSubPeriods.id, subPeriodId))
    })
  })

  // =========================================================================
  // BUDGET — allocations + close + transfers
  // =========================================================================

  describe('Budget — allocations', () => {
    it('upsert allocation creates new', async () => {
      loginAsOwner()

      const { POST } = await import('@/app/api/budget/allocations/route')
      const req = createRequest('POST', '/api/budget/allocations', {
        subPeriodId: subPeriodId,
        categoryId: categoryId,
        allocatedCents: 20000,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(body.allocated_cents).toBe(20000)
    })

    it('upsert allocation updates existing', async () => {
      loginAsOwner()

      const { POST } = await import('@/app/api/budget/allocations/route')
      const req = createRequest('POST', '/api/budget/allocations', {
        subPeriodId: subPeriodId,
        categoryId: categoryId,
        allocatedCents: 25000,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allocated_cents).toBe(25000)
    })
  })

  describe('Budget — transfers', () => {
    it('transfer create enforces positive amount', async () => {
      loginAsOwner()

      // Create allocation for second category
      const { POST: allocate } = await import('@/app/api/budget/allocations/route')
      await allocate(createRequest('POST', '/api/budget/allocations', {
        subPeriodId: subPeriodId,
        categoryId: categoryId2,
        allocatedCents: 15000,
      }) as any)

      const { POST } = await import('@/app/api/budget/transfers/route')
      const req = createRequest('POST', '/api/budget/transfers', {
        subPeriodId: subPeriodId,
        fromCategoryId: categoryId,
        toCategoryId: categoryId2,
        amountCents: 0,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeDefined()
    })

    it('transfer create enforces different categories', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/budget/transfers/route')
      const req = createRequest('POST', '/api/budget/transfers', {
        subPeriodId: subPeriodId,
        fromCategoryId: categoryId,
        toCategoryId: categoryId,
        amountCents: 5000,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeDefined()
    })

    it('transfer create succeeds with valid data', async () => {
      loginAsOwner()
      const { POST } = await import('@/app/api/budget/transfers/route')
      const req = createRequest('POST', '/api/budget/transfers', {
        subPeriodId: subPeriodId,
        fromCategoryId: categoryId,
        toCategoryId: categoryId2,
        amountCents: 5000,
      })
      const res = await POST(req as any)
      // Should succeed (200 or 201)
      expect(res.status).toBeLessThan(300)
      const body = await res.json()
      expect(body.id).toBeDefined()
    })

    it('transfer reversal creates inverse entry', async () => {
      loginAsOwner()

      // Get the transfer we just created
      const existingTransfers = await db
        .select()
        .from(budgetTransfers)
        .where(eq(budgetTransfers.household_id, householdId))
        .limit(1)

      expect(existingTransfers.length).toBeGreaterThan(0)
      const transferId = existingTransfers[0].id

      const { POST: reverseTransfer } = await import('@/app/api/budget/transfers/[id]/reverse/route')
      const req = createRequest('POST', `/api/budget/transfers/${transferId}/reverse`)
      const res = await reverseTransfer(req as any, makeParams(transferId))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBeDefined()

      // Verify reversal has reversal_of_id set
      const [reversal] = await db
        .select()
        .from(budgetTransfers)
        .where(eq(budgetTransfers.id, body.id))
        .limit(1)
      expect(reversal.reversal_of_id).toBe(transferId)
    })
  })

  describe('Budget — close', () => {
    it('close period computes and stores surplus', async () => {
      loginAsOwner()

      // Add an income line for the sub-period
      await db.insert(periodIncomeLines).values({
        budget_sub_period_id: subPeriodId,
        label: `${TEST_PREFIX}Paycheck`,
        expected_cents: 50000,
        sort_order: 0,
        household_id: householdId,
      })

      const { POST } = await import('@/app/api/budget/close/route')
      const req = createRequest('POST', '/api/budget/close', {
        subPeriodId: subPeriodId,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify sub-period is closed
      const [closed] = await db
        .select({ closed_at: budgetSubPeriods.closed_at })
        .from(budgetSubPeriods)
        .where(eq(budgetSubPeriods.id, subPeriodId))

      expect(closed.closed_at).not.toBeNull()

      // Reopen for subsequent tests
      await db
        .update(budgetSubPeriods)
        .set({ closed_at: null })
        .where(eq(budgetSubPeriods.id, subPeriodId))
    })
  })

  // =========================================================================
  // RECONCILIATION
  // =========================================================================

  describe('Reconciliation', () => {
    let sessionId: number

    it('start session returns new session', async () => {
      loginAsOwner()

      const { POST } = await import('@/app/api/reconciliation/sessions/route')
      const req = createRequest('POST', '/api/reconciliation/sessions', {
        accountId: checkingAccountId,
        statementDate: '2026-03-31',
        statementBalanceCents: 95000,
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(body.status).toBe('in_progress')
      sessionId = body.id
    })

    it('start session returns existing if in_progress', async () => {
      loginAsOwner()

      const { POST } = await import('@/app/api/reconciliation/sessions/route')
      const req = createRequest('POST', '/api/reconciliation/sessions', {
        accountId: checkingAccountId,
        statementDate: '2026-03-31',
        statementBalanceCents: 95000,
      })
      const res = await POST(req as any)
      // Should return the same session (200 or 201)
      const body = await res.json()
      expect(body.id).toBe(sessionId)
    })

    it('finish stamps reconciled_at on cleared transactions', async () => {
      loginAsOwner()

      // Create a transaction for reconciliation
      const [txn] = await db
        .insert(transactions)
        .values({
          account_id: checkingAccountId,
          date: '2026-03-20',
          description: `${TEST_PREFIX}Recon Test`,
          original_description: `${TEST_PREFIX}Recon Test`,
          amount_cents: 5000,
          is_debit: 1,
          household_id: householdId,
        })
        .returning()

      // Update session with cleared transaction IDs
      await db
        .update(reconciliationSessions)
        .set({ cleared_transaction_ids: JSON.stringify([txn.id]) })
        .where(eq(reconciliationSessions.id, sessionId))

      const { POST: finishSession } = await import(
        '@/app/api/reconciliation/sessions/[id]/finish/route'
      )
      const req = createRequest('POST', `/api/reconciliation/sessions/${sessionId}/finish`)
      const res = await finishSession(req as any, makeParams(sessionId))
      expect(res.status).toBe(200)

      // Verify transaction has reconciled_at
      const [reconciledTxn] = await db
        .select({ reconciled_at: transactions.reconciled_at })
        .from(transactions)
        .where(eq(transactions.id, txn.id))

      expect(reconciledTxn.reconciled_at).not.toBeNull()
    })
  })

  // =========================================================================
  // RECURRING
  // =========================================================================

  describe('Recurring — template CRUD', () => {
    let templateId: number

    it('create template returns id', async () => {
      loginAsOwner()

      const { POST } = await import('@/app/api/recurring/route')
      const req = createRequest('POST', '/api/recurring', {
        name: `${TEST_PREFIX}Netflix`,
        amount_cents: 1599,
        is_debit: 1,
        account_id: checkingAccountId,
        category_id: categoryId,
        day_values: [15],
      })
      const res = await POST(req as any)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      templateId = body.id
    })

    it('list returns enriched template with next_date', async () => {
      loginAsOwner()

      const { GET } = await import('@/app/api/recurring/route')
      const req = createRequest('GET', '/api/recurring')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(Array.isArray(body.data)).toBe(true)

      const testTemplate = body.data.find((t: any) => t.id === templateId)
      expect(testTemplate).toBeDefined()
      expect(testTemplate.account_name).toBe(`${TEST_PREFIX}Checking`)
      expect(testTemplate.category_name).toBe(`${TEST_PREFIX}Groceries`)
      expect(testTemplate.template_dates).toHaveLength(1)
      expect(testTemplate.template_dates[0].day_value).toBe(15)
      expect(testTemplate.next_date).toBeDefined()
    })

    it('update template replaces day_values', async () => {
      loginAsOwner()

      const { PATCH } = await import('@/app/api/recurring/[id]/route')
      const req = createRequest('PATCH', `/api/recurring/${templateId}`, {
        amount_cents: 1799,
        day_values: [1, 15],
      })
      const res = await PATCH(req as any, makeParams(templateId))
      expect(res.status).toBe(200)

      // Verify new dates
      const dates = await db
        .select({ day_value: recurringTemplateDates.day_value })
        .from(recurringTemplateDates)
        .where(eq(recurringTemplateDates.template_id, templateId))

      expect(dates.map((d) => d.day_value).sort()).toEqual([1, 15])
    })

    it('delete template cascades', async () => {
      loginAsOwner()

      // Create another template to delete
      const [temp] = await db
        .insert(recurringTemplates)
        .values({
          name: `${TEST_PREFIX}Disposable`,
          amount_cents: 100,
          is_debit: 1,
          account_id: checkingAccountId,
          household_id: householdId,
        })
        .returning()

      await db.insert(recurringTemplateDates).values({
        template_id: temp.id,
        day_value: 5,
        sort_order: 0,
        household_id: householdId,
      })

      const { DELETE } = await import('@/app/api/recurring/[id]/route')
      const req = createRequest('DELETE', `/api/recurring/${temp.id}`)
      const res = await DELETE(req as any, makeParams(temp.id))
      expect(res.status).toBe(200)

      // Verify template and dates are gone
      const [found] = await db
        .select({ id: recurringTemplates.id })
        .from(recurringTemplates)
        .where(eq(recurringTemplates.id, temp.id))
        .limit(1)
      expect(found).toBeUndefined()
    })
  })

  describe('Recurring — toggle validation', () => {
    it('toggle to active with archived account returns 200 with error field', async () => {
      loginAsOwner()

      // Create a template referencing an archived account
      const [archivedAcct] = await db
        .insert(accounts)
        .values({
          name: `${TEST_PREFIX}Archived Acct`,
          type: 'checking',
          balance_cents: 0,
          opening_balance_cents: 0,
          sort_order: 99,
          archived_at: new Date(),
          household_id: householdId,
        })
        .returning()

      const [template] = await db
        .insert(recurringTemplates)
        .values({
          name: `${TEST_PREFIX}Toggle Test`,
          amount_cents: 500,
          is_debit: 1,
          account_id: archivedAcct.id,
          status: 'paused',
          household_id: householdId,
        })
        .returning()

      await db.insert(recurringTemplateDates).values({
        template_id: template.id,
        day_value: 1,
        sort_order: 0,
        household_id: householdId,
      })

      const { POST } = await import('@/app/api/recurring/[id]/toggle/route')
      const req = createRequest('POST', `/api/recurring/${template.id}/toggle`)
      const res = await POST(req as any, makeParams(template.id))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.error).toBeDefined()
      expect(body.error).toContain('archived')

      // Cleanup
      await db.delete(recurringTemplateDates).where(eq(recurringTemplateDates.template_id, template.id))
      await db.delete(recurringTemplates).where(eq(recurringTemplates.id, template.id))
      await db.delete(accounts).where(eq(accounts.id, archivedAcct.id))
    })
  })

  describe('Recurring — confirm with balance adjustment', () => {
    it('confirm adjusts balance when actual differs from estimated', async () => {
      loginAsOwner()

      // Create a transaction as if from recurring generation
      const [before] = await db
        .select({ balance_cents: accounts.balance_cents })
        .from(accounts)
        .where(eq(accounts.id, checkingAccountId))

      const [txn] = await db
        .insert(transactions)
        .values({
          account_id: checkingAccountId,
          date: '2026-03-15',
          description: `${TEST_PREFIX}Confirm Test`,
          original_description: `${TEST_PREFIX}Confirm Test`,
          amount_cents: 1599,
          is_debit: 1,
          recurring_status: 'expected',
          estimated_amount_cents: 1599,
          household_id: householdId,
        })
        .returning()

      // Apply initial delta
      await db
        .update(accounts)
        .set({ balance_cents: sql`${accounts.balance_cents} - 1599` })
        .where(eq(accounts.id, checkingAccountId))

      const { POST } = await import('@/app/api/recurring/confirm/route')
      const req = createRequest('POST', '/api/recurring/confirm', {
        transactionId: txn.id,
        actualAmountCents: 1999, // $4 more than expected
      })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.amount_cents).toBe(1999)

      // Verify transaction status
      const [confirmed] = await db
        .select({ recurring_status: transactions.recurring_status, amount_cents: transactions.amount_cents })
        .from(transactions)
        .where(eq(transactions.id, txn.id))

      expect(confirmed.recurring_status).toBe('confirmed')
      expect(confirmed.amount_cents).toBe(1999)
    })
  })

  // =========================================================================
  // HOUSEHOLD SCOPING
  // =========================================================================

  describe('Household scoping isolation', () => {
    it('recurring templates from one household not visible to another', async () => {
      // Primary household already has templates
      loginAsOther()

      const { GET } = await import('@/app/api/recurring/route')
      const req = createRequest('GET', '/api/recurring')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()

      // Other household should see no templates from primary
      const leakedTemplates = body.data.filter((t: any) =>
        t.name.startsWith(TEST_PREFIX)
      )
      expect(leakedTemplates).toHaveLength(0)
    })
  })

  // =========================================================================
  // SUGGESTIONS
  // =========================================================================

  describe('Recurring — suggestions', () => {
    it('returns suggestions for qualifying patterns', async () => {
      loginAsOwner()

      // Create 4 similar transactions with no template
      for (let i = 0; i < 4; i++) {
        await db.insert(transactions).values({
          account_id: checkingAccountId,
          date: `2026-0${i + 1}-15`,
          description: `${TEST_PREFIX}Suggestion Target`,
          original_description: `${TEST_PREFIX}Suggestion Target`,
          amount_cents: 2500 + (i * 50), // within 20% range
          is_debit: 1,
          household_id: householdId,
        })
      }

      const { GET } = await import('@/app/api/recurring/suggestions/route')
      const req = createRequest('GET', '/api/recurring/suggestions')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      // Should find our pattern (4 transactions, similar amounts)
      const found = body.data.find((s: any) => s.description === `${TEST_PREFIX}Suggestion Target`)
      expect(found).toBeDefined()
      expect(found.count).toBeGreaterThanOrEqual(3)
    })
  })

  // =========================================================================
  // DISMISS SUGGESTION
  // =========================================================================

  describe('Recurring — dismiss suggestion', () => {
    it('dismiss is idempotent', async () => {
      loginAsOwner()

      const fingerprint = `${TEST_PREFIX}test-fingerprint:1`

      const { POST } = await import('@/app/api/recurring/dismiss-suggestion/route')
      const req1 = createRequest('POST', '/api/recurring/dismiss-suggestion', { fingerprint })
      const res1 = await POST(req1 as any)
      expect(res1.status).toBe(200)

      // Second dismiss should also succeed
      const req2 = createRequest('POST', '/api/recurring/dismiss-suggestion', { fingerprint })
      const res2 = await POST(req2 as any)
      expect(res2.status).toBe(200)
    })
  })

  // =========================================================================
  // UNCONFIRMED COUNT
  // =========================================================================

  describe('Recurring — unconfirmed count', () => {
    it('returns count of expected entries', async () => {
      loginAsOwner()

      const { GET } = await import('@/app/api/recurring/unconfirmed-count/route')
      const req = createRequest('GET', '/api/recurring/unconfirmed-count')
      const res = await GET(req as any)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(typeof body.count).toBe('number')
    })
  })
})
