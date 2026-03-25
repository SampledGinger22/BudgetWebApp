import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetTransfers, budgetSubPeriods, budgetAllocations } from '@/db/schema/budget'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'

/**
 * POST /api/budget/transfers/[id]/reverse
 *
 * Reverse an existing budget transfer.
 * Guards:
 *  - Original transfer must exist
 *  - Original must not be a reversal itself (no reversal-of-reversal)
 *  - Original must not have already been reversed (no duplicate reversal)
 *  - Sub-period must be open and unlocked
 *
 * Creates a new transfer record with reversal_of_id pointing to the original,
 * then adjusts allocations in the opposite direction.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: transferIdStr } = await params
    const transferId = parseInt(transferIdStr, 10)

    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 })
    }

    // Fetch original transfer
    const [original] = await db
      .select()
      .from(budgetTransfers)
      .where(
        and(
          eq(budgetTransfers.id, transferId),
          eq(budgetTransfers.household_id, householdId),
        ),
      )
      .limit(1)

    if (!original) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Block reversal-of-reversal
    if (original.reversal_of_id !== null) {
      return NextResponse.json(
        { error: 'Cannot reverse a reversal' },
        { status: 400 },
      )
    }

    // Block duplicate reversal — check if any transfer already reverses this one
    const [existingReversal] = await db
      .select({ id: budgetTransfers.id })
      .from(budgetTransfers)
      .where(
        and(
          eq(budgetTransfers.reversal_of_id, transferId),
          eq(budgetTransfers.household_id, householdId),
        ),
      )
      .limit(1)

    if (existingReversal) {
      return NextResponse.json(
        { error: 'Transfer has already been reversed' },
        { status: 409 },
      )
    }

    // Check sub-period is open and unlocked
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        closed_at: budgetSubPeriods.closed_at,
        locked_at: budgetSubPeriods.locked_at,
      })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, original.budget_sub_period_id),
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

    // Insert reversal transfer (swapped from/to)
    const [reversal] = await db
      .insert(budgetTransfers)
      .values({
        budget_sub_period_id: original.budget_sub_period_id,
        from_category_id: original.to_category_id,
        to_category_id: original.from_category_id,
        amount_cents: original.amount_cents,
        note: `Reversal of transfer #${original.id}`,
        reversal_of_id: original.id,
        from_category_name: original.to_category_name,
        to_category_name: original.from_category_name,
        household_id: householdId,
      })
      .returning()

    // Adjust allocations: add back to original source (now reversal destination)
    await db
      .insert(budgetAllocations)
      .values({
        budget_sub_period_id: original.budget_sub_period_id,
        category_id: original.from_category_id,
        allocated_cents: 0,
        household_id: householdId,
      })
      .onConflictDoNothing({
        target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
      })

    await db
      .update(budgetAllocations)
      .set({
        allocated_cents: sql`${budgetAllocations.allocated_cents} + ${original.amount_cents}`,
      })
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, original.budget_sub_period_id),
          eq(budgetAllocations.category_id, original.from_category_id),
          eq(budgetAllocations.household_id, householdId),
        ),
      )

    // Deduct from original destination (now reversal source)
    await db
      .insert(budgetAllocations)
      .values({
        budget_sub_period_id: original.budget_sub_period_id,
        category_id: original.to_category_id,
        allocated_cents: 0,
        household_id: householdId,
      })
      .onConflictDoNothing({
        target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
      })

    await db
      .update(budgetAllocations)
      .set({
        allocated_cents: sql`${budgetAllocations.allocated_cents} - ${original.amount_cents}`,
      })
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, original.budget_sub_period_id),
          eq(budgetAllocations.category_id, original.to_category_id),
          eq(budgetAllocations.household_id, householdId),
        ),
      )

    return NextResponse.json({
      id: reversal.id,
      reversal_of_id: original.id,
      amount_cents: original.amount_cents,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/transfers/[id]/reverse error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
