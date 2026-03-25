import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods, budgetPeriods } from '@/db/schema/budget'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/budget/periods-status
 *
 * Returns all budget sub-periods with their lifecycle status:
 *  - is_closed: boolean
 *  - is_locked: boolean
 *  - needs_close: true if end_date < today and not closed
 *
 * Useful for dashboard display and period lifecycle management.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const subPeriods = await db
      .select({
        id: budgetSubPeriods.id,
        budget_period_id: budgetSubPeriods.budget_period_id,
        start_date: budgetSubPeriods.start_date,
        end_date: budgetSubPeriods.end_date,
        surplus_carry_forward_cents: budgetSubPeriods.surplus_carry_forward_cents,
        sort_order: budgetSubPeriods.sort_order,
        closed_at: budgetSubPeriods.closed_at,
        locked_at: budgetSubPeriods.locked_at,
        is_carry_only: budgetSubPeriods.is_carry_only,
        created_at: budgetSubPeriods.created_at,
        period_start_date: budgetPeriods.start_date,
        period_end_date: budgetPeriods.end_date,
        pay_schedule_id: budgetPeriods.pay_schedule_id,
      })
      .from(budgetSubPeriods)
      .innerJoin(budgetPeriods, eq(budgetPeriods.id, budgetSubPeriods.budget_period_id))
      .where(eq(budgetSubPeriods.household_id, householdId))
      .orderBy(asc(budgetSubPeriods.start_date), asc(budgetSubPeriods.sort_order))

    const today = new Date().toISOString().split('T')[0]

    const data = subPeriods.map((sp) => ({
      id: sp.id,
      budget_period_id: sp.budget_period_id,
      start_date: sp.start_date,
      end_date: sp.end_date,
      surplus_carry_forward_cents: sp.surplus_carry_forward_cents,
      sort_order: sp.sort_order,
      is_carry_only: sp.is_carry_only,
      created_at: sp.created_at,
      period_start_date: sp.period_start_date,
      period_end_date: sp.period_end_date,
      pay_schedule_id: sp.pay_schedule_id,
      is_closed: sp.closed_at !== null,
      is_locked: sp.locked_at !== null,
      closed_at: sp.closed_at,
      locked_at: sp.locked_at,
      needs_close: sp.closed_at === null && sp.end_date < today,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] GET /api/budget/periods-status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
