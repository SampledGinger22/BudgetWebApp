import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { householdMembers } from '@/db/schema/transactions'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/members/[id]/archive
 *
 * Sets archived_at = now() on the member.
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
      return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await db
      .update(householdMembers)
      .set({ archived_at: new Date() })
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[members] archive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
