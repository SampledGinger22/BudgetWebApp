import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  budgetPeriods,
  budgetSubPeriods,
  periodIncomeLines,
  budgetAllocations,
} from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, gt } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/periods/regenerate
 *
 * Wipe empty future periods and regenerate. Deletes budget_periods where:
 * - start_date > today
 * - No transactions in any sub-period
 * - No allocations in any sub-period
 * - Not customized
 *
 * After deleting, the caller should POST /api/periods/generate to recreate.
 */
export async function POST() {
  try {
    const { householdId } = await requireAuth()

    const today = new Date().toISOString().split('T')[0]

    // Find future non-customized periods
    const futurePeriods = await db
      .select({ id: budgetPeriods.id })
      .from(budgetPeriods)
      .where(
        and(
          eq(budgetPeriods.household_id, householdId),
          gt(budgetPeriods.start_date, today),
          eq(budgetPeriods.is_customized, 0),
        ),
      )

    let deletedCount = 0

    for (const period of futurePeriods) {
      // Get sub-period IDs
      const subPeriods = await db
        .select({ id: budgetSubPeriods.id })
        .from(budgetSubPeriods)
        .where(eq(budgetSubPeriods.budget_period_id, period.id))

      const subIds = subPeriods.map((sp) => sp.id)

      if (subIds.length > 0) {
        // Check allocations
        const [allocCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(budgetAllocations)
          .where(
            sql`${budgetAllocations.budget_sub_period_id} IN (${sql.join(
              subIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )

        if ((allocCount?.count ?? 0) > 0) continue

        // Check transactions
        const [txnCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            sql`${transactions.budget_sub_period_id} IN (${sql.join(
              subIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )

        if ((txnCount?.count ?? 0) > 0) continue

        // Delete income lines first
        for (const subId of subIds) {
          await db
            .delete(periodIncomeLines)
            .where(eq(periodIncomeLines.budget_sub_period_id, subId))
        }
      }

      // Delete period (sub-periods cascade)
      await db.delete(budgetPeriods).where(eq(budgetPeriods.id, period.id))
      deletedCount++
    }

    return NextResponse.json({ deletedPeriods: deletedCount })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST regenerate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
