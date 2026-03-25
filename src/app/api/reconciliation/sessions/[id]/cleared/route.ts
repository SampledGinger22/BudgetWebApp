import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateClearedSchema } from '@/lib/validators/reconciliation'

/**
 * PUT /api/reconciliation/sessions/[id]/cleared
 *
 * Updates the cleared transaction IDs for an in_progress session.
 * Stored as a JSON-serialized array in the cleared_transaction_ids column.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateClearedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify session exists and is in_progress
    const [session] = await db
      .select({ id: reconciliationSessions.id, status: reconciliationSessions.status })
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
        { error: 'Cannot update cleared IDs on a completed session' },
        { status: 409 },
      )
    }

    await db
      .update(reconciliationSessions)
      .set({ cleared_transaction_ids: JSON.stringify(parsed.data.clearedIds) })
      .where(
        and(
          eq(reconciliationSessions.id, id),
          eq(reconciliationSessions.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] PUT cleared error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
