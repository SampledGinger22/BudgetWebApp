import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { accounts } from '@/db/schema/accounts'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/accounts/[id]/unarchive
 *
 * Clears archived_at (sets to null) on the account.
 * Scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await db
      .update(accounts)
      .set({ archived_at: null })
      .where(and(eq(accounts.id, id), eq(accounts.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] unarchive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
