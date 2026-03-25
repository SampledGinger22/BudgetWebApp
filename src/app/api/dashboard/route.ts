import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { accounts } from '@/db/schema/accounts'
import { eq, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/dashboard
 *
 * Returns account summaries for the authenticated user's household
 * with balances grouped by account type and a net total.
 *
 * Response: {
 *   accounts: Array<{ id, name, type, balance_cents, archived_at }>,
 *   totals: { checking: number, savings: number, credit: number,
 *             student_loan: number, standard_loan: number, net: number }
 * }
 */
export async function GET(_request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    // Query all accounts for this household (including archived for full picture)
    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        balance_cents: accounts.balance_cents,
        archived_at: accounts.archived_at,
      })
      .from(accounts)
      .where(eq(accounts.household_id, householdId))
      .orderBy(asc(accounts.sort_order), asc(accounts.id))

    // Compute totals by type (only from non-archived accounts)
    const totals: Record<string, number> = {
      checking: 0,
      savings: 0,
      credit: 0,
      student_loan: 0,
      standard_loan: 0,
    }

    let net = 0
    for (const acct of allAccounts) {
      if (!acct.archived_at) {
        const type = acct.type
        if (type in totals) {
          totals[type] += acct.balance_cents
        }
        net += acct.balance_cents
      }
    }

    return NextResponse.json({
      accounts: allAccounts,
      totals: { ...totals, net },
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[dashboard] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
