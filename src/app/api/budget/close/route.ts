import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods, periodIncomeLines } from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { computeSurplus } from '@/lib/utils/budget-engine'
import { z } from 'zod'

const closeSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/budget/close
 *
 * Close a budget sub-period:
 *  1. Verify sub-period is open (not already closed)
 *  2. Query total income and total spent
 *  3. Compute surplus via computeSurplus()
 *  4. Update sub-period with closed_at and surplus_carry_forward_cents
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = closeSchema.safeParse(body)
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
    if (subPeriod.closed_at) {
      return NextResponse.json({ error: 'Period is already closed' }, { status: 409 })
    }

    // Query total income for this sub-period
    const [incomeResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${periodIncomeLines.expected_cents}), 0)`,
      })
      .from(periodIncomeLines)
      .where(
        and(
          eq(periodIncomeLines.budget_sub_period_id, subPeriodId),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )

    // Query total spent
    const [spentResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(
          CASE WHEN ${transactions.is_debit} = 1 THEN ${transactions.amount_cents}
               ELSE -${transactions.amount_cents} END
        ), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.budget_sub_period_id, subPeriodId),
          eq(transactions.household_id, householdId),
          isNull(transactions.voided_at),
        ),
      )

    const totalIncome = Number(incomeResult?.total ?? 0)
    const totalSpent = Number(spentResult?.total ?? 0)
    const surplus = computeSurplus(totalIncome, totalSpent)

    // Update sub-period
    await db
      .update(budgetSubPeriods)
      .set({
        closed_at: new Date(),
        surplus_carry_forward_cents: surplus,
      })
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )

    return NextResponse.json({
      success: true,
      surplus_carry_forward_cents: surplus,
      total_income_cents: totalIncome,
      total_spent_cents: totalSpent,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/close error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
