/**
 * Smoke test: proves Drizzle can connect to Postgres, insert data, and read it back.
 * Skips gracefully when DATABASE_URL is not set OR the database is unreachable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../schema'

const { households, accounts, transactions } = schema

const TEST_HOUSEHOLD_NAME = '__smoke_test_household__'

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

describe.skipIf(!process.env.DATABASE_URL)('Database smoke tests', () => {
  beforeAll(async () => {
    db = createTestDb()
    dbReachable = await checkConnection(db)
    if (!dbReachable) {
      console.warn('⚠️  DATABASE_URL is set but database is unreachable — skipping smoke tests')
    }
  })

  afterAll(async () => {
    if (!dbReachable) {
      if (pool) await pool.end().catch(() => {})
      return
    }

    // Clean up test data — delete test household and cascade will be manual
    // since we don't have ON DELETE CASCADE on household_id FKs.
    // Delete in reverse FK order.
    try {
      const testHouseholds = await db
        .select()
        .from(households)
        .where(eq(households.name, TEST_HOUSEHOLD_NAME))

      for (const h of testHouseholds) {
        await db.delete(transactions).where(eq(transactions.household_id, h.id))
        await db.delete(accounts).where(eq(accounts.household_id, h.id))
        await db.delete(households).where(eq(households.id, h.id))
      }
    } catch {
      // Best-effort cleanup
    }

    if (pool) {
      await pool.end().catch(() => {})
    }
  })

  it('can connect to database and query households', async ({ skip }) => {
    if (!dbReachable) skip()
    const result = await db.select().from(households)
    expect(Array.isArray(result)).toBe(true)
  })

  it('can insert and read back an account', async ({ skip }) => {
    if (!dbReachable) skip()

    // Insert a test household first (FK requirement)
    const [testHousehold] = await db
      .insert(households)
      .values({ name: TEST_HOUSEHOLD_NAME, max_members: 1 })
      .returning()

    // Insert an account referencing the household
    const [inserted] = await db
      .insert(accounts)
      .values({
        name: 'Smoke Test Checking',
        type: 'checking',
        balance_cents: 100000,
        household_id: testHousehold.id,
      })
      .returning()

    // Read it back
    const [fetched] = await db.select().from(accounts).where(eq(accounts.id, inserted.id))

    expect(fetched.name).toBe('Smoke Test Checking')
    expect(fetched.type).toBe('checking')
    expect(fetched.balance_cents).toBe(100000)
    expect(fetched.household_id).toBe(testHousehold.id)
  })

  it('monetary columns are integer cents', async ({ skip }) => {
    if (!dbReachable) skip()

    // Find or create a test household
    let [testHousehold] = await db
      .select()
      .from(households)
      .where(eq(households.name, TEST_HOUSEHOLD_NAME))

    if (!testHousehold) {
      ;[testHousehold] = await db
        .insert(households)
        .values({ name: TEST_HOUSEHOLD_NAME, max_members: 1 })
        .returning()
    }

    // Need an account for the transaction FK
    const [testAccount] = await db
      .insert(accounts)
      .values({
        name: 'Smoke Test Cents',
        type: 'savings',
        balance_cents: 0,
        household_id: testHousehold.id,
      })
      .returning()

    // Insert a transaction with a specific cent amount
    const [txn] = await db
      .insert(transactions)
      .values({
        account_id: testAccount.id,
        date: '2026-01-15',
        description: 'Cents test',
        original_description: 'Cents test',
        amount_cents: 12345,
        is_debit: 1,
        household_id: testHousehold.id,
      })
      .returning()

    // Read it back and verify type + value
    const [fetched] = await db.select().from(transactions).where(eq(transactions.id, txn.id))

    expect(typeof fetched.amount_cents).toBe('number')
    expect(fetched.amount_cents).toBe(12345)
  })
})
