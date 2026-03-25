import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { recalculateCarryForward } from '@/lib/utils/budget-carry-forward'
import { z } from 'zod'

const reopenSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/budget/reopen
 *
 * Reopen a closed budget sub-period:
 *  1. Verify sub-period is closed
 *  2. Clear closed_at and reset surplus
 *  3. Cascade recalculate carry-forward for all subsequent closed
 *     sub-periods within the same budget_period
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = reopenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { subPeriodId } = parsed.data

    // Fetch sub-period
    const [subPeriod] = await db
      .select()
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    if (!subPeriod) {
      return NextResponse.json({ error: 'Sub-period not found' }, { status: 404 })
    }
    if (!subPeriod.closed_at) {
      return NextResponse.json({ error: 'Period is not closed' }, { status: 409 })
    }

    // Clear closed_at and reset surplus
    await db
      .update(budgetSubPeriods)
      .set({
        closed_at: null,
        surplus_carry_forward_cents: 0,
      })
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )

    // Cascade recalculate carry-forward for subsequent closed sub-periods
    await recalculateCarryForward(subPeriod.budget_period_id, subPeriod.sort_order, householdId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/reopen error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
