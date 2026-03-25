import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  budgetTransfers,
  budgetSubPeriods,
  budgetAllocations,
  categories,
} from '@/db/schema/budget'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createTransferSchema } from '@/lib/validators/budget'
import { z } from 'zod'

const listTransfersQuerySchema = z.object({
  subPeriodId: z.coerce.number().int(),
})

/**
 * GET /api/budget/transfers?subPeriodId=X
 *
 * List all budget transfers for a sub-period with has_been_reversed flag.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = listTransfersQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { subPeriodId } = parsed.data

    // Fetch all transfers for this sub-period
    const allTransfers = await db
      .select()
      .from(budgetTransfers)
      .where(
        and(
          eq(budgetTransfers.budget_sub_period_id, subPeriodId),
          eq(budgetTransfers.household_id, householdId),
        ),
      )
      .orderBy(budgetTransfers.created_at)

    // Build a set of IDs that have been reversed (i.e., appear as reversal_of_id)
    const reversedIds = new Set(
      allTransfers
        .filter((t) => t.reversal_of_id !== null)
        .map((t) => t.reversal_of_id!),
    )

    const data = allTransfers.map((t) => ({
      ...t,
      has_been_reversed: reversedIds.has(t.id),
      is_reversal: t.reversal_of_id !== null,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] GET /api/budget/transfers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/budget/transfers
 *
 * Create a budget transfer between two categories with 5 guard checks:
 *  1. Sub-period must be open and unlocked
 *  2. Source and destination must differ
 *  3. Amount must be positive (enforced by Zod)
 *  4. Both categories must be in the same category_group
 *  5. Source must have sufficient available balance (silently caps if not)
 *
 * After guards pass:
 *  - Insert transfer record
 *  - Ensure source allocation exists (onConflictDoNothing)
 *  - Deduct from source allocation
 *  - Ensure destination allocation exists (onConflictDoNothing)
 *  - Add to destination allocation
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { budget_sub_period_id, from_category_id, to_category_id, amount_cents, note } =
      parsed.data

    // Guard 1: Sub-period must be open and unlocked
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        closed_at: budgetSubPeriods.closed_at,
        locked_at: budgetSubPeriods.locked_at,
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
    if (subPeriod.closed_at) {
      return NextResponse.json({ error: 'Period is closed' }, { status: 409 })
    }
    if (subPeriod.locked_at) {
      return NextResponse.json({ error: 'Period is locked' }, { status: 409 })
    }

    // Guard 2: Source and destination must differ
    if (from_category_id === to_category_id) {
      return NextResponse.json(
        { error: 'Source and destination categories must differ' },
        { status: 400 },
      )
    }

    // Guard 4: Both categories must be in the same category_group
    const [fromCat] = await db
      .select({ id: categories.id, name: categories.name, category_group_id: categories.category_group_id })
      .from(categories)
      .where(and(eq(categories.id, from_category_id), eq(categories.household_id, householdId)))
      .limit(1)

    const [toCat] = await db
      .select({ id: categories.id, name: categories.name, category_group_id: categories.category_group_id })
      .from(categories)
      .where(and(eq(categories.id, to_category_id), eq(categories.household_id, householdId)))
      .limit(1)

    if (!fromCat || !toCat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (fromCat.category_group_id !== toCat.category_group_id) {
      return NextResponse.json(
        { error: 'Categories must be in the same category group' },
        { status: 400 },
      )
    }

    // Guard 5: Source must have sufficient available balance (silently cap)
    const [sourceAlloc] = await db
      .select({ allocated_cents: budgetAllocations.allocated_cents })
      .from(budgetAllocations)
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
          eq(budgetAllocations.category_id, from_category_id),
          eq(budgetAllocations.household_id, householdId),
        ),
      )
      .limit(1)

    const sourceAvailable = sourceAlloc?.allocated_cents ?? 0
    const cappedAmount = Math.min(amount_cents, Math.max(0, sourceAvailable))

    if (cappedAmount <= 0) {
      return NextResponse.json(
        { error: 'Insufficient source balance for transfer' },
        { status: 400 },
      )
    }

    // Insert transfer record
    const [transfer] = await db
      .insert(budgetTransfers)
      .values({
        budget_sub_period_id,
        from_category_id,
        to_category_id,
        amount_cents: cappedAmount,
        note: note ?? null,
        from_category_name: fromCat.name,
        to_category_name: toCat.name,
        household_id: householdId,
      })
      .returning()

    // Ensure source allocation exists
    await db
      .insert(budgetAllocations)
      .values({
        budget_sub_period_id,
        category_id: from_category_id,
        allocated_cents: 0,
        household_id: householdId,
      })
      .onConflictDoNothing({
        target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
      })

    // Deduct from source
    await db
      .update(budgetAllocations)
      .set({
        allocated_cents: sql`${budgetAllocations.allocated_cents} - ${cappedAmount}`,
      })
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
          eq(budgetAllocations.category_id, from_category_id),
          eq(budgetAllocations.household_id, householdId),
        ),
      )

    // Ensure destination allocation exists
    await db
      .insert(budgetAllocations)
      .values({
        budget_sub_period_id,
        category_id: to_category_id,
        allocated_cents: 0,
        household_id: householdId,
      })
      .onConflictDoNothing({
        target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
      })

    // Add to destination
    await db
      .update(budgetAllocations)
      .set({
        allocated_cents: sql`${budgetAllocations.allocated_cents} + ${cappedAmount}`,
      })
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, budget_sub_period_id),
          eq(budgetAllocations.category_id, to_category_id),
          eq(budgetAllocations.household_id, householdId),
        ),
      )

    return NextResponse.json({
      id: transfer.id,
      amount_cents: cappedAmount,
      was_capped: cappedAmount !== amount_cents,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/transfers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
