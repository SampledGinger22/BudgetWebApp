import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { eq, and, isNull, lte, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/reconciliation/unreconciled
 *
 * Returns all unreconciled (non-voided) transactions for an account
 * up to the given statement date. Ordered chronologically.
 *
 * Query params:
 *   - accountId (required)
 *   - statementDate (required) — include transactions dated <= this date
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const sp = request.nextUrl.searchParams
    const accountId = parseInt(sp.get('accountId') ?? '', 10)
    const statementDate = sp.get('statementDate')

    if (isNaN(accountId) || !statementDate) {
      return NextResponse.json(
        { error: 'accountId and statementDate are required' },
        { status: 400 },
      )
    }

    // Verify account belongs to household
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const rows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.account_id, accountId),
          eq(transactions.household_id, householdId),
          isNull(transactions.reconciled_at),
          isNull(transactions.voided_at),
          lte(transactions.date, statementDate),
        ),
      )
      .orderBy(asc(transactions.date), asc(transactions.id))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] GET unreconciled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
