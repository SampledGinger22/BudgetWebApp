import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { accounts } from '@/db/schema/accounts'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { startSessionSchema } from '@/lib/validators/reconciliation'

/**
 * POST /api/reconciliation/sessions
 *
 * Starts a new reconciliation session, or returns an existing in_progress session
 * for the same account. Prevents multiple concurrent sessions per account.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = startSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { accountId, statementDate, statementBalanceCents } = parsed.data

    // Verify account belongs to household
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Check for existing in_progress session
    const [existing] = await db
      .select()
      .from(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.account_id, accountId),
          eq(reconciliationSessions.household_id, householdId),
          eq(reconciliationSessions.status, 'in_progress'),
        ),
      )
      .limit(1)

    if (existing) {
      return NextResponse.json(existing)
    }

    // Create new session
    const [created] = await db
      .insert(reconciliationSessions)
      .values({
        account_id: accountId,
        statement_date: statementDate,
        statement_balance_cents: statementBalanceCents,
        status: 'in_progress',
        cleared_transaction_ids: JSON.stringify([]),
        household_id: householdId,
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] POST sessions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
