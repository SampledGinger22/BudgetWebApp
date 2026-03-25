import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { payScheduleHistory } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updatePayChangeSchema } from '@/lib/validators/periods'

/**
 * PATCH /api/periods/pay-changes/[id]
 *
 * Update a pay change entry.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const changeId = Number(id)
    if (Number.isNaN(changeId)) {
      return NextResponse.json({ error: 'Invalid pay change ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updatePayChangeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [existing] = await db
      .select({ id: payScheduleHistory.id })
      .from(payScheduleHistory)
      .where(
        and(
          eq(payScheduleHistory.id, changeId),
          eq(payScheduleHistory.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Pay change not found' }, { status: 404 })
    }

    await db
      .update(payScheduleHistory)
      .set(parsed.data)
      .where(
        and(
          eq(payScheduleHistory.id, changeId),
          eq(payScheduleHistory.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] PATCH pay-change error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/periods/pay-changes/[id]
 *
 * Delete a pay change entry.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const changeId = Number(id)
    if (Number.isNaN(changeId)) {
      return NextResponse.json({ error: 'Invalid pay change ID' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: payScheduleHistory.id })
      .from(payScheduleHistory)
      .where(
        and(
          eq(payScheduleHistory.id, changeId),
          eq(payScheduleHistory.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Pay change not found' }, { status: 404 })
    }

    await db
      .delete(payScheduleHistory)
      .where(
        and(
          eq(payScheduleHistory.id, changeId),
          eq(payScheduleHistory.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] DELETE pay-change error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
