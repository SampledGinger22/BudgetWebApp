import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { accounts } from '@/db/schema/accounts'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/reconciliation/history
 *
 * Returns completed reconciliation sessions for an account, ordered by
 * completed_at descending (most recent first).
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

    // Verify account belongs to household
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const sessions = await db
      .select()
      .from(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.account_id, accountId),
          eq(reconciliationSessions.household_id, householdId),
          eq(reconciliationSessions.status, 'completed'),
        ),
      )
      .orderBy(desc(reconciliationSessions.completed_at))

    return NextResponse.json(sessions)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] GET history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
