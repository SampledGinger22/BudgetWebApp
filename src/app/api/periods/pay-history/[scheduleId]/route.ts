import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { payScheduleHistory } from '@/db/schema/budget'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/periods/pay-history/[scheduleId]
 *
 * Get pay change history for a specific pay schedule.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { scheduleId } = await params
    const schedId = Number(scheduleId)
    if (Number.isNaN(schedId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 })
    }

    const rows = await db
      .select()
      .from(payScheduleHistory)
      .where(
        and(
          eq(payScheduleHistory.pay_schedule_id, schedId),
          eq(payScheduleHistory.household_id, householdId),
        ),
      )
      .orderBy(asc(payScheduleHistory.effective_date))

    return NextResponse.json({ data: rows })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] GET pay-history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
