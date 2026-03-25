import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { paySchedules, budgetPeriods } from '@/db/schema/budget'
import { eq, and, ne, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateScheduleSchema } from '@/lib/validators/periods'

/**
 * GET /api/periods/schedules/[id]
 *
 * Get a single pay schedule by ID. Used for saveSchedule upsert pattern.
 */
export async function GET(
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

    const [schedule] = await db
      .select()
      .from(paySchedules)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )
      .limit(1)

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] GET schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/periods/schedules/[id]
 *
 * Update a pay schedule. If setting is_primary=1, clears primary from all others.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const scheduleId = Number(id)
    if (Number.isNaN(scheduleId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify schedule belongs to household
    const [existing] = await db
      .select({ id: paySchedules.id })
      .from(paySchedules)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // If setting as primary, clear others first
    if (parsed.data.is_primary === 1) {
      await db
        .update(paySchedules)
        .set({ is_primary: 0 })
        .where(
          and(
            eq(paySchedules.household_id, householdId),
            ne(paySchedules.id, scheduleId),
          ),
        )
    }

    await db
      .update(paySchedules)
      .set(parsed.data)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] PATCH schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/periods/schedules/[id]
 *
 * Delete a pay schedule. If deleting the primary:
 * 1. Promotes the next schedule to primary
 * 2. Reassigns budget_periods from deleted schedule to the new primary
 */
export async function DELETE(
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

    // Fetch the schedule to check if primary
    const [schedule] = await db
      .select({ id: paySchedules.id, is_primary: paySchedules.is_primary })
      .from(paySchedules)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )
      .limit(1)

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // If deleting the primary schedule, promote the next one
    if (schedule.is_primary === 1) {
      const [nextSchedule] = await db
        .select({ id: paySchedules.id })
        .from(paySchedules)
        .where(
          and(
            eq(paySchedules.household_id, householdId),
            ne(paySchedules.id, scheduleId),
          ),
        )
        .orderBy(asc(paySchedules.id))
        .limit(1)

      if (nextSchedule) {
        // Promote next schedule to primary
        await db
          .update(paySchedules)
          .set({ is_primary: 1 })
          .where(eq(paySchedules.id, nextSchedule.id))

        // Reassign budget periods from deleted schedule to new primary
        await db
          .update(budgetPeriods)
          .set({ pay_schedule_id: nextSchedule.id })
          .where(
            and(
              eq(budgetPeriods.pay_schedule_id, scheduleId),
              eq(budgetPeriods.household_id, householdId),
            ),
          )
      }
    }

    // Delete the schedule
    await db
      .delete(paySchedules)
      .where(
        and(eq(paySchedules.id, scheduleId), eq(paySchedules.household_id, householdId)),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] DELETE schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
