import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { payScheduleHistory, paySchedules } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { addPayChangeSchema } from '@/lib/validators/periods'

/**
 * POST /api/periods/pay-changes
 *
 * Add a new pay change entry for a pay schedule.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = addPayChangeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify pay schedule belongs to household
    const [schedule] = await db
      .select({ id: paySchedules.id })
      .from(paySchedules)
      .where(
        and(
          eq(paySchedules.id, parsed.data.pay_schedule_id),
          eq(paySchedules.household_id, householdId),
        ),
      )
      .limit(1)

    if (!schedule) {
      return NextResponse.json({ error: 'Pay schedule not found' }, { status: 404 })
    }

    const [created] = await db
      .insert(payScheduleHistory)
      .values({
        pay_schedule_id: parsed.data.pay_schedule_id,
        effective_date: parsed.data.effective_date,
        amount_cents: parsed.data.amount_cents,
        notes: parsed.data.notes ?? null,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST pay-change error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
