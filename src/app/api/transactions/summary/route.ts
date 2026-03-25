import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { eq, and, sql, isNull, gte, lte, like, isNotNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { computeBalanceDelta } from '@/lib/utils/accounting'

/**
 * GET /api/transactions/summary
 *
 * Returns summary statistics for an account:
 * - balance_cents (current account balance)
 * - income_cents (sum of credits in filtered set)
 * - expense_cents (sum of debits in filtered set)
 * - count (total transactions in filtered set)
 *
 * Supports same filters as list endpoint: accountId, subPeriodId, date_from, date_to,
 * category_id, member_id, vendor_id, search.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const sp = request.nextUrl.searchParams
    const accountId = parseInt(sp.get('accountId') ?? '', 10)
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Verify account
    const [account] = await db
      .select({
        id: accounts.id,
        type: accounts.type,
        balance_cents: accounts.balance_cents,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(transactions.account_id, accountId),
      eq(transactions.household_id, householdId),
      isNull(transactions.voided_at),
    ]

    const subPeriodId = sp.get('subPeriodId')
    if (subPeriodId) {
      const spId = parseInt(subPeriodId, 10)
      if (!isNaN(spId)) conditions.push(eq(transactions.budget_sub_period_id, spId))
    }

    const dateFrom = sp.get('date_from')
    if (dateFrom) conditions.push(gte(transactions.date, dateFrom))

    const dateTo = sp.get('date_to')
    if (dateTo) conditions.push(lte(transactions.date, dateTo))

    const categoryId = sp.get('category_id')
    if (categoryId) {
      const cId = parseInt(categoryId, 10)
      if (!isNaN(cId)) conditions.push(eq(transactions.category_id, cId))
    }

    const memberId = sp.get('member_id')
    if (memberId) {
      const mId = parseInt(memberId, 10)
      if (!isNaN(mId)) conditions.push(eq(transactions.member_id, mId))
    }

    const vendorId = sp.get('vendor_id')
    if (vendorId) {
      const vId = parseInt(vendorId, 10)
      if (!isNaN(vId)) conditions.push(eq(transactions.vendor_id, vId))
    }

    const search = sp.get('search')
    if (search) conditions.push(like(transactions.description, `%${search}%`))

    const reconciledStatus = sp.get('reconciled_status')
    if (reconciledStatus === 'reconciled') {
      conditions.push(isNotNull(transactions.reconciled_at))
    } else if (reconciledStatus === 'unreconciled') {
      conditions.push(isNull(transactions.reconciled_at))
    }

    // Compute summary via aggregate query
    const [summary] = await db
      .select({
        count: sql<number>`count(*)::int`,
        income_cents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.is_debit} = 0 THEN ${transactions.amount_cents} ELSE 0 END), 0)::int`,
        expense_cents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.is_debit} = 1 THEN ${transactions.amount_cents} ELSE 0 END), 0)::int`,
      })
      .from(transactions)
      .where(and(...conditions))

    return NextResponse.json({
      balance_cents: account.balance_cents,
      income_cents: summary?.income_cents ?? 0,
      expense_cents: summary?.expense_cents ?? 0,
      count: summary?.count ?? 0,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[transactions] GET summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
