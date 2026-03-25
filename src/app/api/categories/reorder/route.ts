import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { reorderCategoriesSchema } from '@/lib/validators/categories'

/**
 * POST /api/categories/reorder
 *
 * Reorders categories by setting sort_order = index for each id in the array.
 * Scoped to category_group_id = groupId AND household_id.
 * Sequential updates without db.transaction() (neon-http constraint).
 *
 * Request body: { groupId: number, ids: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = reorderCategoriesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { groupId, ids } = parsed.data

    // Sequential updates scoped to groupId AND householdId
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(categories)
        .set({ sort_order: i })
        .where(
          and(
            eq(categories.id, ids[i]),
            eq(categories.category_group_id, groupId),
            eq(categories.household_id, householdId),
          ),
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
