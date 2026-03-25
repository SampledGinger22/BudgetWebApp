/**
 * Seed script for local development.
 * Run: npx tsx --env-file=.env.local src/db/seed.ts
 *
 * Populates a household with a user, category groups, categories, accounts,
 * pay schedule, transactions, and a vendor — proving all FKs and constraints work.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import pg from 'pg'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

const {
  households,
  users,
  categoryGroups,
  categories,
  accounts,
  paySchedules,
  transactions,
  vendors,
} = schema

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.warn('⚠️  DATABASE_URL is not set — skipping seed. Copy .env.local.example to .env.local and configure.')
  process.exit(0)
}

function createDb() {
  if (databaseUrl!.includes('.neon.tech')) {
    const sql = neon(databaseUrl!)
    return drizzleNeon(sql, { schema })
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 })
  return drizzle(pool, { schema })
}

const db = createDb()

async function seed() {
  console.log('🌱 Seeding database...\n')

  // Clean up any existing seed data to make the script idempotent
  const existingHouseholds = await db
    .select()
    .from(households)
    .where(eq(households.name, 'Demo Household'))

  for (const h of existingHouseholds) {
    await db.delete(vendors).where(eq(vendors.household_id, h.id))
    await db.delete(transactions).where(eq(transactions.household_id, h.id))
    await db.delete(paySchedules).where(eq(paySchedules.household_id, h.id))
    await db.delete(accounts).where(eq(accounts.household_id, h.id))
    await db.delete(categories).where(eq(categories.household_id, h.id))
    await db.delete(categoryGroups).where(eq(categoryGroups.household_id, h.id))
    await db.delete(users).where(eq(users.household_id, h.id))
    await db.delete(households).where(eq(households.id, h.id))
  }

  // 1. Insert household
  const [household] = await db
    .insert(households)
    .values({ name: 'Demo Household', max_members: 2 })
    .returning()
  console.log(`✅ households: 1 row (id=${household.id})`)

  const householdId = household.id

  // 2. Insert user
  const [user] = await db
    .insert(users)
    .values({
      email: 'demo@example.com',
      name: 'Demo User',
      household_id: householdId,
    })
    .returning()
  console.log(`✅ users: 1 row (id=${user.id})`)

  // 3. Update household owner_id
  await db.update(households).set({ owner_id: user.id }).where(eq(households.id, householdId))
  console.log(`✅ households.owner_id updated to ${user.id}`)

  // 4. Insert system category groups
  const [incomeGroup] = await db
    .insert(categoryGroups)
    .values({
      name: 'Income',
      is_system: 1,
      sort_order: 0,
      household_id: householdId,
    })
    .returning()

  const [expenseGroup] = await db
    .insert(categoryGroups)
    .values({
      name: 'Expense',
      is_system: 1,
      sort_order: 1,
      household_id: householdId,
    })
    .returning()

  const [savingsGroup] = await db
    .insert(categoryGroups)
    .values({
      name: 'Savings/Goals',
      is_system: 1,
      sort_order: 2,
      household_id: householdId,
    })
    .returning()
  console.log(
    `✅ category_groups: 3 rows (ids=${incomeGroup.id}, ${expenseGroup.id}, ${savingsGroup.id})`,
  )

  // 5. Insert categories
  const [salaryCategory] = await db
    .insert(categories)
    .values({
      category_group_id: incomeGroup.id,
      name: 'Salary',
      sort_order: 0,
      household_id: householdId,
    })
    .returning()

  const [groceriesCategory] = await db
    .insert(categories)
    .values({
      category_group_id: expenseGroup.id,
      name: 'Groceries',
      sort_order: 0,
      household_id: householdId,
    })
    .returning()
  console.log(
    `✅ categories: 2 rows (ids=${salaryCategory.id}, ${groceriesCategory.id})`,
  )

  // 6. Insert accounts
  const [checkingAccount] = await db
    .insert(accounts)
    .values({
      name: 'Checking',
      type: 'checking',
      balance_cents: 500000,
      household_id: householdId,
    })
    .returning()

  const [creditAccount] = await db
    .insert(accounts)
    .values({
      name: 'Credit Card',
      type: 'credit',
      balance_cents: 0,
      household_id: householdId,
    })
    .returning()
  console.log(
    `✅ accounts: 2 rows (ids=${checkingAccount.id}, ${creditAccount.id})`,
  )

  // 7. Insert pay schedule
  const [paySchedule] = await db
    .insert(paySchedules)
    .values({
      name: 'Primary',
      schedule_type: 'biweekly',
      is_primary: 1,
      anchor_date: '2026-01-02',
      household_id: householdId,
    })
    .returning()
  console.log(`✅ pay_schedules: 1 row (id=${paySchedule.id})`)

  // 8. Insert transactions
  const [debitTxn] = await db
    .insert(transactions)
    .values({
      account_id: checkingAccount.id,
      date: '2026-03-20',
      description: 'Whole Foods Market',
      original_description: 'WHOLE FOODS MKT #10234',
      amount_cents: -5000,
      is_debit: 1,
      category_id: groceriesCategory.id,
      household_id: householdId,
    })
    .returning()

  const [creditTxn] = await db
    .insert(transactions)
    .values({
      account_id: checkingAccount.id,
      date: '2026-03-15',
      description: 'Payroll Deposit',
      original_description: 'ACH PAYROLL DEPOSIT',
      amount_cents: 250000,
      is_debit: 0,
      category_id: salaryCategory.id,
      household_id: householdId,
    })
    .returning()
  console.log(`✅ transactions: 2 rows (ids=${debitTxn.id}, ${creditTxn.id})`)

  // 9. Insert vendor
  const [vendor] = await db
    .insert(vendors)
    .values({
      name: 'Whole Foods',
      default_category_id: groceriesCategory.id,
      type: 'vendor',
      household_id: householdId,
    })
    .returning()
  console.log(`✅ vendors: 1 row (id=${vendor.id})`)

  console.log('\n🎉 Seed complete! Inserted:')
  console.log('   1 household, 1 user, 3 category_groups, 2 categories,')
  console.log('   2 accounts, 1 pay_schedule, 2 transactions, 1 vendor')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    // Connection refused / timeout → skip gracefully (DB not running)
    // Drizzle wraps pg errors in DrizzleQueryError with a `cause` property.
    // The cause may be an AggregateError with a `code` property.
    const fullMsg = JSON.stringify(err, Object.getOwnPropertyNames(err), 2) ?? ''
    const causeCode = err?.cause?.code ?? ''
    if (
      fullMsg.includes('ECONNREFUSED') ||
      fullMsg.includes('ETIMEDOUT') ||
      fullMsg.includes('Connection terminated') ||
      fullMsg.includes('timeout expired') ||
      causeCode === 'ECONNREFUSED' ||
      causeCode === 'ETIMEDOUT'
    ) {
      console.warn(`⚠️  Database unreachable — skipping seed.`)
      process.exit(0)
    }
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
