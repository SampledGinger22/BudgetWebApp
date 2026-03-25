import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { transactions } from '@/db/schema/transactions'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/reconciliation/sessions/[id]/finish
 *
 * Finishes a reconciliation session:
 * 1. Stamps reconciled_at on all cleared transactions (via inArray)
 * 2. Marks session as completed with optimistic concurrency:
 *    UPDATE ... SET status='completed' WHERE id=? AND status='in_progress'
 *    If 0 rows affected, session was already completed → 409 conflict.
 *
 * No db.transaction() — uses sequential queries with optimistic concurrency.
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

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Session is already completed' },
        { status: 409 },
      )
    }

    // Parse cleared transaction IDs
    const clearedIds: number[] = session.cleared_transaction_ids
      ? JSON.parse(session.cleared_transaction_ids)
      : []

    // Step 1: Stamp reconciled_at on cleared transactions
    if (clearedIds.length > 0) {
      await db
        .update(transactions)
        .set({ reconciled_at: new Date() })
        .where(
          and(
            inArray(transactions.id, clearedIds),
            eq(transactions.household_id, householdId),
          ),
        )
    }

    // Step 2: Mark session completed with optimistic concurrency
    const updated = await db
      .update(reconciliationSessions)
      .set({
        status: 'completed',
        completed_at: new Date(),
      })
      .where(
        and(
          eq(reconciliationSessions.id, id),
          eq(reconciliationSessions.household_id, householdId),
          eq(reconciliationSessions.status, 'in_progress'),
        ),
      )
      .returning()

    if (updated.length === 0) {
      // Another request completed it — optimistic concurrency conflict
      return NextResponse.json(
        { error: 'Session was already completed by another request' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true, clearedCount: clearedIds.length })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] POST finish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
