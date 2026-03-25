import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { recalculateCarryForward } from '@/lib/utils/budget-carry-forward'
import { z } from 'zod'

const unlockSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/budget/unlock
 *
 * Unlock a budget sub-period.
 * Clears locked_at and cascades carry-forward recalculation
 * to subsequent closed sub-periods.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = unlockSchema.safeParse(body)
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
    if (!subPeriod.locked_at) {
      return NextResponse.json({ error: 'Period is not locked' }, { status: 409 })
    }

    // Clear locked_at
    await db
      .update(budgetSubPeriods)
      .set({ locked_at: null })
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
    console.error('[budget] POST /api/budget/unlock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
