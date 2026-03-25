import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetAllocations, budgetSubPeriods, periodIncomeLines } from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'

const summaryQuerySchema = z.object({
  subPeriodId: z.coerce.number().int(),
})

/**
 * GET /api/budget/summary?subPeriodId=X
 *
 * Returns budget totals for a sub-period:
 *  - total_income_cents (sum of income lines expected_cents)
 *  - carry_forward_cents (surplus from prior sub-period)
 *  - total_allocated_cents (sum of allocations)
 *  - total_spent_cents (sum of transaction deltas)
 *  - total_remaining_cents (allocated - spent)
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = summaryQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { subPeriodId } = parsed.data

    // Verify sub-period exists and belongs to household
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        surplus_carry_forward_cents: budgetSubPeriods.surplus_carry_forward_cents,
      })
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

    // Total income
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

    // Total allocated
    const [allocResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${budgetAllocations.allocated_cents}), 0)`,
      })
      .from(budgetAllocations)
      .where(
        and(
          eq(budgetAllocations.budget_sub_period_id, subPeriodId),
          eq(budgetAllocations.household_id, householdId),
        ),
      )

    // Total spent (debit = positive expense, credit = negative = income return)
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
    const carryForward = subPeriod.surplus_carry_forward_cents
    const totalAllocated = Number(allocResult?.total ?? 0)
    const totalSpent = Number(spentResult?.total ?? 0)

    return NextResponse.json({
      total_income_cents: totalIncome,
      carry_forward_cents: carryForward,
      total_allocated_cents: totalAllocated,
      total_spent_cents: totalSpent,
      total_remaining_cents: totalAllocated - totalSpent,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] GET /api/budget/summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
