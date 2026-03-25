import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  budgetPeriods,
  budgetSubPeriods,
  periodIncomeLines,
  paySchedules,
} from '@/db/schema/budget'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/periods
 *
 * List all budget periods with nested sub-periods and income lines.
 * Returns a hierarchical structure for the period tree display.
 */
export async function GET() {
  try {
    const { householdId } = await requireAuth()

    // Fetch all periods ordered by start_date
    const periods = await db
      .select()
      .from(budgetPeriods)
      .where(eq(budgetPeriods.household_id, householdId))
      .orderBy(asc(budgetPeriods.start_date))

    // Fetch all sub-periods for this household
    const subPeriods = await db
      .select()
      .from(budgetSubPeriods)
      .where(eq(budgetSubPeriods.household_id, householdId))
      .orderBy(asc(budgetSubPeriods.sort_order))

    // Fetch all income lines for this household
    const incomeLines = await db
      .select()
      .from(periodIncomeLines)
      .where(eq(periodIncomeLines.household_id, householdId))
      .orderBy(asc(periodIncomeLines.sort_order))

    // Build nested structure
    const data = periods.map((period) => {
      const periodSubPeriods = subPeriods
        .filter((sp) => sp.budget_period_id === period.id)
        .map((sp) => ({
          ...sp,
          income_lines: incomeLines.filter((il) => il.budget_sub_period_id === sp.id),
        }))

      return {
        ...period,
        sub_periods: periodSubPeriods,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] GET list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
