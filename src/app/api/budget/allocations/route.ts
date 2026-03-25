import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetAllocations, budgetSubPeriods, categories } from '@/db/schema/budget'
import { eq, and, sql, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { upsertAllocationSchema } from '@/lib/validators/budget'

/**
 * POST /api/budget/allocations
 *
 * Upsert a budget allocation for a (sub_period, category) pair.
 * Implements parent/child clamping:
 *  - If editing a child category: clamp to parent_allocated - sibling_sum
 *  - If editing a parent category: clamp to min(value, children_sum)
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = upsertAllocationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { budget_sub_period_id, category_id, allocated_cents, auto_split } = parsed.data

    // Verify sub-period belongs to household and is not locked
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        locked_at: budgetSubPeriods.locked_at,
        closed_at: budgetSubPeriods.closed_at,
      })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, budget_sub_period_id),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    if (!subPeriod) {
      return NextResponse.json({ error: 'Sub-period not found' }, { status: 404 })
    }
    if (subPeriod.locked_at) {
      return NextResponse.json({ error: 'Period is locked' }, { status: 409 })
    }

    // Fetch the category to check parent_id
    const [category] = await db
      .select({ id: categories.id, parent_id: categories.parent_id })
      .from(categories)
      .where(and(eq(categories.id, category_id), eq(categories.household_id, householdId)))
      .limit(1)

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    let clampedCents = allocated_cents

    if (category.parent_id) {
      // Editing a child: clamp to parent_allocated - sibling_sum
      const [parentAlloc] = await db
        .select({ allocated_cents: budgetAllocations.allocated_cents })
        .from(budgetAllocations)
        .where(
          and(
            eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
            eq(budgetAllocations.category_id, category.parent_id),
            eq(budgetAllocations.household_id, householdId),
          ),
        )
        .limit(1)

      const parentAllocated = parentAlloc?.allocated_cents ?? 0

      // Sum siblings (other children of the same parent, excluding this category)
      const [siblingSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(${budgetAllocations.allocated_cents}), 0)` })
        .from(budgetAllocations)
        .innerJoin(categories, eq(categories.id, budgetAllocations.category_id))
        .where(
          and(
            eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
            eq(categories.parent_id, category.parent_id),
            ne(budgetAllocations.category_id, category_id),
            eq(budgetAllocations.household_id, householdId),
          ),
        )

      const available = parentAllocated - (siblingSum?.total ?? 0)
      clampedCents = Math.min(allocated_cents, Math.max(0, available))
    } else {
      // Editing a parent: check if it has children
      const childCategories = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.parent_id, category_id), eq(categories.household_id, householdId)),
        )

      if (childCategories.length > 0) {
        // Sum children allocations
        const childCatIds = childCategories.map((c) => c.id)
        const [childSum] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${budgetAllocations.allocated_cents}), 0)`,
          })
          .from(budgetAllocations)
          .where(
            and(
              eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
              sql`${budgetAllocations.category_id} IN (${sql.join(
                childCatIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
              eq(budgetAllocations.household_id, householdId),
            ),
          )

        const childrenTotal = childSum?.total ?? 0
        // Parent must be at least the sum of children
        clampedCents = Math.max(allocated_cents, childrenTotal)
      }
    }

    // Upsert allocation
    const [result] = await db
      .insert(budgetAllocations)
      .values({
        budget_sub_period_id,
        category_id,
        allocated_cents: clampedCents,
        auto_split: auto_split ?? 0,
        household_id: householdId,
      })
      .onConflictDoUpdate({
        target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
        set: {
          allocated_cents: clampedCents,
          auto_split: auto_split ?? 0,
        },
      })
      .returning()

    return NextResponse.json({
      id: result.id,
      allocated_cents: clampedCents,
      was_clamped: clampedCents !== allocated_cents,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/allocations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
