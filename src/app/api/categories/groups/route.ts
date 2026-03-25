import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categoryGroups } from '@/db/schema/budget'
import { eq, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createGroupSchema } from '@/lib/validators/categories'

const MAX_GROUPS_PER_HOUSEHOLD = 5

/**
 * POST /api/categories/groups
 *
 * Creates a new category group for the authenticated user's household.
 * Enforces a maximum of 5 groups per household.
 * Auto-assigns sort_order via COALESCE(MAX(sort_order), -1) + 1.
 *
 * Request body: see createGroupSchema
 * Response 201: { id }
 * Response 409: max groups limit reached
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createGroupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Enforce max 5 groups per household
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(categoryGroups)
      .where(eq(categoryGroups.household_id, householdId))

    if ((countResult?.count ?? 0) >= MAX_GROUPS_PER_HOUSEHOLD) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_GROUPS_PER_HOUSEHOLD} category groups per household` },
        { status: 409 },
      )
    }

    // Auto sort_order
    const [maxResult] = await db
      .select({
        maxSort: sql<number>`COALESCE(MAX(${categoryGroups.sort_order}), -1)`,
      })
      .from(categoryGroups)
      .where(eq(categoryGroups.household_id, householdId))

    const nextSortOrder = (maxResult?.maxSort ?? -1) + 1

    const [created] = await db
      .insert(categoryGroups)
      .values({
        name: parsed.data.name,
        color: parsed.data.color,
        sort_order: nextSortOrder,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] createGroup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
