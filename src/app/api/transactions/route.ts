import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { budgetSubPeriods } from '@/db/schema/budget'
import { eq, and, sql, asc, desc, gte, lte, isNull, isNotNull, like, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { listTransactionsQuerySchema, createTransactionSchema } from '@/lib/validators/transactions'
import { computeBalanceDelta } from '@/lib/utils/accounting'

/**
 * GET /api/transactions
 *
 * Lists transactions for an account with running balance computation.
 * Supports 12 filter parameters, pagination, and synthetic "Starting Balance" row.
 *
 * Running balance algorithm:
 * 1. Fetch transactions in chronological order (date ASC, id ASC)
 * 2. Compute baseline = current account balance - SUM(all visible row deltas)
 * 3. Accumulate forward: each row's running balance = baseline + cumulative delta
 * 4. Future-dated transactions get null running_balance_cents
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = listTransactionsQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const filters = parsed.data

    // Fetch the account for type (liability-aware) and balance
    const [account] = await db
      .select({
        id: accounts.id,
        type: accounts.type,
        balance_cents: accounts.balance_cents,
        as_of_date: accounts.as_of_date,
        opening_balance_cents: accounts.opening_balance_cents,
      })
      .from(accounts)
      .where(and(eq(accounts.id, filters.accountId), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(transactions.account_id, filters.accountId),
      eq(transactions.household_id, householdId),
      isNull(transactions.voided_at),
    ]

    if (filters.subPeriodId) {
      conditions.push(eq(transactions.budget_sub_period_id, filters.subPeriodId))
    }
    if (filters.category_id) {
      conditions.push(eq(transactions.category_id, filters.category_id))
    }
    if (filters.member_id) {
      conditions.push(eq(transactions.member_id, filters.member_id))
    }
    if (filters.vendor_id) {
      conditions.push(eq(transactions.vendor_id, filters.vendor_id))
    }
    if (filters.search) {
      conditions.push(like(transactions.description, `%${filters.search}%`))
    }
    if (filters.amount_min !== undefined) {
      conditions.push(gte(transactions.amount_cents, filters.amount_min))
    }
    if (filters.amount_max !== undefined) {
      conditions.push(lte(transactions.amount_cents, filters.amount_max))
    }
    if (filters.import_batch_id) {
      conditions.push(eq(transactions.import_batch_id, filters.import_batch_id))
    }
    if (filters.reconciled_status === 'reconciled') {
      conditions.push(isNotNull(transactions.reconciled_at))
    } else if (filters.reconciled_status === 'unreconciled') {
      conditions.push(isNull(transactions.reconciled_at))
    }
    if (filters.date_from) {
      conditions.push(gte(transactions.date, filters.date_from))
    }
    if (filters.date_to) {
      conditions.push(lte(transactions.date, filters.date_to))
    }

    // Fetch all matching transactions in chronological order
    const rows = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(asc(transactions.date), asc(transactions.id))

    // Running balance computation
    const today = new Date().toISOString().split('T')[0]
    const accountType = account.type

    // Sum all visible row deltas to compute baseline
    let totalDelta = 0
    for (const row of rows) {
      totalDelta += computeBalanceDelta(row.amount_cents, row.is_debit, accountType)
    }

    // Baseline = current balance minus all visible deltas
    let baseline = account.balance_cents - totalDelta
    let cumulativeDelta = 0

    const rowsWithBalance = rows.map((row) => {
      const delta = computeBalanceDelta(row.amount_cents, row.is_debit, accountType)
      cumulativeDelta += delta
      const isFuture = row.date > today
      return {
        ...row,
        running_balance_cents: isFuture ? null : baseline + cumulativeDelta,
      }
    })

    // Inject synthetic "Starting Balance" row if account has as_of_date within filter window
    let result: Array<typeof rowsWithBalance[number] | { id: 0; synthetic: true; description: string; date: string; amount_cents: number; running_balance_cents: number }> = rowsWithBalance
    if (account.as_of_date) {
      const inWindow =
        (!filters.date_from || account.as_of_date >= filters.date_from) &&
        (!filters.date_to || account.as_of_date <= filters.date_to)
      if (inWindow) {
        result = [
          ...rowsWithBalance,
          {
            id: 0,
            synthetic: true,
            description: 'Starting Balance',
            date: account.as_of_date,
            amount_cents: account.opening_balance_cents,
            running_balance_cents: account.opening_balance_cents,
          } as any,
        ]
      }
    }

    // Pagination
    let totalCount = result.length
    if (filters.page && filters.pageSize) {
      const start = (filters.page - 1) * filters.pageSize
      const paged = result.slice(start, start + filters.pageSize)
      return NextResponse.json({ data: paged, totalCount, page: filters.page, pageSize: filters.pageSize })
    }

    return NextResponse.json({ data: result, totalCount })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[transactions] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/transactions
 *
 * Creates a new transaction. Auto-looks up budget_sub_period_id from the
 * transaction date. Adjusts account balance_cents using computeBalanceDelta.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const data = parsed.data

    // Verify account belongs to household
    const [account] = await db
      .select({ id: accounts.id, type: accounts.type, balance_cents: accounts.balance_cents })
      .from(accounts)
      .where(and(eq(accounts.id, data.account_id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Auto-lookup budget_sub_period_id by date
    const [subPeriod] = await db
      .select({ id: budgetSubPeriods.id })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.household_id, householdId),
          lte(budgetSubPeriods.start_date, data.date),
          gte(budgetSubPeriods.end_date, data.date),
        ),
      )
      .limit(1)

    // Create the transaction
    const [created] = await db
      .insert(transactions)
      .values({
        account_id: data.account_id,
        budget_sub_period_id: subPeriod?.id ?? null,
        date: data.date,
        description: data.description,
        original_description: data.description,
        amount_cents: data.amount_cents,
        is_debit: data.is_debit,
        category_id: data.category_id ?? null,
        vendor_id: data.vendor_id ?? null,
        member_id: data.member_id ?? null,
        recurring_template_id: data.recurring_template_id ?? null,
        recurring_status: data.recurring_status ?? null,
        estimated_amount_cents: data.estimated_amount_cents ?? null,
        fitid: data.fitid ?? null,
        import_batch_id: data.import_batch_id ?? null,
        household_id: householdId,
      })
      .returning()

    // Update account balance
    const delta = computeBalanceDelta(data.amount_cents, data.is_debit, account.type)
    await db
      .update(accounts)
      .set({ balance_cents: sql`${accounts.balance_cents} + ${delta}` })
      .where(and(eq(accounts.id, data.account_id), eq(accounts.household_id, householdId)))

    return NextResponse.json({ id: created.id, budget_sub_period_id: subPeriod?.id ?? null }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[transactions] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
