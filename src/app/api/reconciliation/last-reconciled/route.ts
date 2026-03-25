import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/reconciliation/last-reconciled
 *
 * Returns the last reconciled date for each account in the household.
 * Uses the most recent completed session's statement_date per account.
 *
 * Response: Array of { account_id, last_statement_date, last_completed_at }
 */
export async function GET(_request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const rows = await db
      .select({
        account_id: reconciliationSessions.account_id,
        last_statement_date: sql<string>`MAX(${reconciliationSessions.statement_date})`,
        last_completed_at: sql<string>`MAX(${reconciliationSessions.completed_at})`,
      })
      .from(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.household_id, householdId),
          eq(reconciliationSessions.status, 'completed'),
        ),
      )
      .groupBy(reconciliationSessions.account_id)

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] GET last-reconciled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
