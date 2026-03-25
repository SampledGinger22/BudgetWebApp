import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { isLiabilityAccount } from '@/lib/utils/accounting'

/**
 * GET /api/reconciliation/balance
 *
 * Computes the reconciled balance for an account.
 *
 * Algorithm: account.balance_cents minus the signed sum of unreconciled,
 * non-voided transaction deltas, with liability-aware sign logic.
 *
 * For asset accounts (checking/savings):
 *   reconciled = balance - SUM(unreconciled debits * -1 + unreconciled credits * +1)
 *   which simplifies to: balance - SUM(credit_amounts) + SUM(debit_amounts)
 *
 * For liability accounts (credit/loans):
 *   reconciled = balance - SUM(unreconciled debits * +1 + unreconciled credits * -1)
 *   which simplifies to: balance - SUM(debit_amounts) + SUM(credit_amounts)
 *
 * We use raw SQL for the aggregate computation.
 *
 * Query params: accountId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const accountId = parseInt(request.nextUrl.searchParams.get('accountId') ?? '', 10)
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Fetch account
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

    // Compute unreconciled delta sum
    // For asset: unreconciled_delta = SUM(credit amounts) - SUM(debit amounts)
    // For liability: unreconciled_delta = SUM(debit amounts) - SUM(credit amounts)
    const isLiability = isLiabilityAccount(account.type)

    const [unreconciledAgg] = await db
      .select({
        debit_sum: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.is_debit} = 1 THEN ${transactions.amount_cents} ELSE 0 END), 0)::int`,
        credit_sum: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.is_debit} = 0 THEN ${transactions.amount_cents} ELSE 0 END), 0)::int`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.account_id, accountId),
          eq(transactions.household_id, householdId),
          isNull(transactions.reconciled_at),
          isNull(transactions.voided_at),
        ),
      )

    const debitSum = unreconciledAgg?.debit_sum ?? 0
    const creditSum = unreconciledAgg?.credit_sum ?? 0

    // Unreconciled delta = how much unreconciled txns have moved the balance
    // We need to subtract this from balance to get reconciled balance
    let unreconciledDelta: number
    if (isLiability) {
      // Liability: debits add to balance (+), credits subtract (-)
      unreconciledDelta = debitSum - creditSum
    } else {
      // Asset: debits subtract from balance (-), credits add (+)
      unreconciledDelta = creditSum - debitSum
    }

    const reconciledBalanceCents = account.balance_cents - unreconciledDelta

    return NextResponse.json({
      reconciled_balance_cents: reconciledBalanceCents,
      balance_cents: account.balance_cents,
      unreconciled_delta_cents: unreconciledDelta,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] GET balance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
