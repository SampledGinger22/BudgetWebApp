import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetPeriods, budgetSubPeriods } from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, gt } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * DELETE /api/periods/[id]
 *
 * Delete a budget period. Only allowed for:
 * - Future periods (start_date > today)
 * - Periods with no transactions in any sub-period
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const periodId = Number(id)
    if (Number.isNaN(periodId)) {
      return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    // Fetch the period
    const [period] = await db
      .select({
        id: budgetPeriods.id,
        start_date: budgetPeriods.start_date,
      })
      .from(budgetPeriods)
      .where(
        and(eq(budgetPeriods.id, periodId), eq(budgetPeriods.household_id, householdId)),
      )
      .limit(1)

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    // Guard: must be a future period
    if (period.start_date <= today) {
      return NextResponse.json(
        { error: 'Cannot delete a period that has already started' },
        { status: 409 },
      )
    }

    // Guard: must have no transactions
    const subPeriods = await db
      .select({ id: budgetSubPeriods.id })
      .from(budgetSubPeriods)
      .where(eq(budgetSubPeriods.budget_period_id, periodId))

    const subIds = subPeriods.map((sp) => sp.id)

    if (subIds.length > 0) {
      const [txnCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(
          sql`${transactions.budget_sub_period_id} IN (${sql.join(
            subIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )

      if ((txnCount?.count ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Cannot delete period with transactions' },
          { status: 409 },
        )
      }
    }

    // Delete (sub-periods and income lines cascade)
    await db
      .delete(budgetPeriods)
      .where(
        and(eq(budgetPeriods.id, periodId), eq(budgetPeriods.household_id, householdId)),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] DELETE period error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
