import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reconciliationSessions } from '@/db/schema/reconciliation'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/reconciliation/sessions/[id]
 *
 * Gets a reconciliation session by ID. The [id] param can be:
 * - A numeric session ID → returns that specific session
 * - An account ID with ?byAccount=true → returns in_progress session for that account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const byAccount = request.nextUrl.searchParams.get('byAccount') === 'true'

    if (byAccount) {
      // Interpret [id] as accountId — return in_progress session
      const [session] = await db
        .select()
        .from(reconciliationSessions)
        .where(
          and(
            eq(reconciliationSessions.account_id, id),
            eq(reconciliationSessions.household_id, householdId),
            eq(reconciliationSessions.status, 'in_progress'),
          ),
        )
        .limit(1)

      if (!session) {
        return NextResponse.json({ error: 'No in-progress session found' }, { status: 404 })
      }
      return NextResponse.json(session)
    }

    // Standard: interpret [id] as session ID
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

    return NextResponse.json(session)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] GET session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/reconciliation/sessions/[id]
 *
 * Cancels an in_progress reconciliation session by deleting it.
 * Only allows cancellation of sessions that are still in_progress.
 */
export async function DELETE(
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
        { error: 'Only in-progress sessions can be cancelled' },
        { status: 409 },
      )
    }

    await db
      .delete(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.id, id),
          eq(reconciliationSessions.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[reconciliation] DELETE session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
