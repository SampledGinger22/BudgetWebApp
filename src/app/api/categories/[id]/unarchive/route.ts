import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/categories/[id]/unarchive
 *
 * Clears archived_at on the category only (not sub-categories — user unarchives them individually).
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
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
    }

    // Verify category exists in this household
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    await db
      .update(categories)
      .set({ archived_at: null })
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] unarchive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
