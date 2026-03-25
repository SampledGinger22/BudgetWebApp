import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { transactions } from '@/db/schema/transactions'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/reconciliation/sessions/[id]/undo
 *
 * Undoes a completed reconciliation session:
 * 1. Clears reconciled_at from all cleared transactions (using inArray)
 * 2. Deletes the session record entirely
 *
 * Only allows undoing sessions that are 'completed'.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    // Fetch the session
    const [session] = await db
      .select()
      .from(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.id, id),
          eq(reconciliationSessions.household_id, householdId),
        ),
      )
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed sessions can be undone' },
        { status: 409 },
      )
    }

    // Parse cleared transaction IDs
    const clearedIds: number[] = session.cleared_transaction_ids
      ? JSON.parse(session.cleared_transaction_ids)
      : []

    // Step 1: Clear reconciled_at from cleared transactions
    if (clearedIds.length > 0) {
      await db
        .update(transactions)
        .set({ reconciled_at: null })
        .where(
          and(
            inArray(transactions.id, clearedIds),
            eq(transactions.household_id, householdId),
          ),
        )
    }

    // Step 2: Delete the session
    await db
      .delete(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.id, id),
          eq(reconciliationSessions.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true, unclearedCount: clearedIds.length })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] POST undo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
