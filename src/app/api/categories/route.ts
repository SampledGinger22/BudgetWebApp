import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categoryGroups, categories } from '@/db/schema/budget'
import { eq, and, isNull, isNotNull, asc, sql, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createCategorySchema } from '@/lib/validators/categories'

/**
 * GET /api/categories
 *
 * Lists category groups with nested categories for the authenticated user's household.
 * Two queries (groups + all categories) assembled in JS — avoids N+1.
 * Query params:
 *   - includeArchived=true — include archived categories (default: exclude)
 * Response: Array of group objects, each with a `categories` array of top-level
 * categories, each with a `sub_categories` array.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    // Query 1: all groups for this household
    const groups = await db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.household_id, householdId))
      .orderBy(asc(categoryGroups.sort_order), asc(categoryGroups.id))

    // Query 2: all categories for this household (one query, not per-group)
    const catConditions = [eq(categories.household_id, householdId)]
    if (!includeArchived) {
      catConditions.push(isNull(categories.archived_at))
    }

    const allCategories = await db
      .select()
      .from(categories)
      .where(and(...catConditions))
      .orderBy(asc(categories.sort_order), asc(categories.id))

    // Assemble nested structure in JS
    const result = groups.map((group) => {
      const groupCats = allCategories.filter(
        (c) => c.category_group_id === group.id,
      )
      const topLevel = groupCats.filter((c) => c.parent_id === null)
      const nested = topLevel.map((parent) => ({
        ...parent,
        sub_categories: groupCats.filter((c) => c.parent_id === parent.id),
      }))
      return {
        ...group,
        categories: nested,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/categories
 *
 * Creates a new category within a group.
 * Auto-generates ref_number using group-based offset (groupId * 100) if not provided.
 * Uniqueness check for ref_number is scoped to household only (NOT global).
 * Auto sort_order within parent scope.
 *
 * Request body: see createCategorySchema
 * Response 201: { id, ref_number }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { category_group_id, parent_id, name, ref_number } = parsed.data

    // Verify the group belongs to this household
    const [group] = await db
      .select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(
        and(
          eq(categoryGroups.id, category_group_id),
          eq(categoryGroups.household_id, householdId),
        ),
      )
      .limit(1)

    if (!group) {
      return NextResponse.json({ error: 'Category group not found' }, { status: 404 })
    }

    // Determine ref_number — auto-generate if not provided
    let finalRefNumber = ref_number ?? null

    if (!finalRefNumber) {
      // Auto-generate using group-based offset (groupId * 100)
      const existing = await db
        .select({ ref_number: categories.ref_number })
        .from(categories)
        .where(
          and(
            eq(categories.household_id, householdId),
            isNotNull(categories.ref_number),
          ),
        )

      const usedNumbers = new Set(
        existing
          .map((r) => parseInt(r.ref_number ?? '', 10))
          .filter((n) => !isNaN(n)),
      )

      let next = category_group_id * 100
      while (usedNumbers.has(next)) next++
      finalRefNumber = String(next)
    } else {
      // Validate uniqueness scoped to household (not global)
      const [collision] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.ref_number, finalRefNumber),
            eq(categories.household_id, householdId),
          ),
        )
        .limit(1)

      if (collision) {
        return NextResponse.json(
          { error: 'ref_number already in use within this household' },
          { status: 409 },
        )
      }
    }

    // Auto sort_order scoped to parent context
    const sortConditions = [
      eq(categories.household_id, householdId),
      eq(categories.category_group_id, category_group_id),
    ]
    if (parent_id) {
      sortConditions.push(eq(categories.parent_id, parent_id))
    } else {
      sortConditions.push(isNull(categories.parent_id))
    }

    const [maxResult] = await db
      .select({
        maxSort: sql<number>`COALESCE(MAX(${categories.sort_order}), -1)`,
      })
      .from(categories)
      .where(and(...sortConditions))

    const nextSortOrder = (maxResult?.maxSort ?? -1) + 1

    const [created] = await db
      .insert(categories)
      .values({
        category_group_id,
        parent_id: parent_id ?? null,
        name,
        ref_number: finalRefNumber,
        sort_order: nextSortOrder,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json(
      { id: created.id, ref_number: created.ref_number },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
