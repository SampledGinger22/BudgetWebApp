import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { paySchedules, budgetPeriods } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/periods/schedules/[id]/primary
 *
 * Set a schedule as the primary. Atomically:
 * 1. Clears is_primary on all household schedules
 * 2. Sets is_primary=1 on the target schedule
 * 3. Reassigns all budget_periods to the new primary
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const scheduleId = Number(id)
    if (Number.isNaN(scheduleId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 })
    }

    // Verify schedule belongs to household
    const [schedule] = await db
      .select({ id: paySchedules.id })
      .from(paySchedules)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )
      .limit(1)

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Clear all primaries for this household
    await db
      .update(paySchedules)
      .set({ is_primary: 0 })
      .where(eq(paySchedules.household_id, householdId))

    // Set this schedule as primary
    await db
      .update(paySchedules)
      .set({ is_primary: 1 })
      .where(eq(paySchedules.id, scheduleId))

    // Reassign all budget periods to this schedule
    await db
      .update(budgetPeriods)
      .set({ pay_schedule_id: scheduleId })
      .where(eq(budgetPeriods.household_id, householdId))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST set primary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
