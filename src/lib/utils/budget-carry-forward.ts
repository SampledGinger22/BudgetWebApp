/**
 * Budget period carry-forward cascade recalculation.
 *
 * Shared between reopen and unlock routes — both need to recompute
 * surplus_carry_forward_cents for subsequent closed sub-periods
 * after a period state change.
 */
import { db } from '@/db'
import { budgetSubPeriods, periodIncomeLines } from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, gt, isNotNull, isNull, asc } from 'drizzle-orm'
import { computeSurplus } from '@/lib/utils/budget-engine'

/**
 * Recalculate surplus_carry_forward_cents for all closed sub-periods
 * after the given sort_order within a budget period.
 *
 * Called by reopen and unlock routes to cascade carry-forward changes
 * when a preceding sub-period is reopened or unlocked.
 */
export async function recalculateCarryForward(
  budgetPeriodId: number,
  afterSortOrder: number,
  householdId: number,
) {
  // Find all closed sub-periods in this budget period after the given sort_order
  const subsequentClosed = await db
    .select()
    .from(budgetSubPeriods)
    .where(
      and(
        eq(budgetSubPeriods.budget_period_id, budgetPeriodId),
        eq(budgetSubPeriods.household_id, householdId),
        gt(budgetSubPeriods.sort_order, afterSortOrder),
        isNotNull(budgetSubPeriods.closed_at),
      ),
    )
    .orderBy(asc(budgetSubPeriods.sort_order))

  for (const sp of subsequentClosed) {
    // Query income for this sub-period
    const [incomeResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${periodIncomeLines.expected_cents}), 0)`,
      })
      .from(periodIncomeLines)
      .where(
        and(
          eq(periodIncomeLines.budget_sub_period_id, sp.id),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )

    // Query spent
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
          eq(transactions.budget_sub_period_id, sp.id),
          eq(transactions.household_id, householdId),
          isNull(transactions.voided_at),
        ),
      )

    const totalIncome = Number(incomeResult?.total ?? 0)
    const totalSpent = Number(spentResult?.total ?? 0)
    const surplus = computeSurplus(totalIncome, totalSpent)

    await db
      .update(budgetSubPeriods)
      .set({ surplus_carry_forward_cents: surplus })
      .where(
        and(
          eq(budgetSubPeriods.id, sp.id),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
  }
}
