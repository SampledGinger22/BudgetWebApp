import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods, periodAuditLog } from '@/db/schema/budget'
import { eq, and, lt, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateSubPeriodSchema } from '@/lib/validators/periods'

/**
 * PATCH /api/periods/sub-periods/[id]
 *
 * Update a sub-period's dates. When start_date changes, auto-adjusts
 * the previous sub-period's end_date to maintain contiguity.
 * Creates audit log entries for both the target and adjacent sub-period.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const subPeriodId = Number(id)
    if (Number.isNaN(subPeriodId)) {
      return NextResponse.json({ error: 'Invalid sub-period ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateSubPeriodSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Fetch the sub-period
    const [subPeriod] = await db
      .select()
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    if (!subPeriod) {
      return NextResponse.json({ error: 'Sub-period not found' }, { status: 404 })
    }

    const updateFields: Record<string, unknown> = {}
    if (parsed.data.start_date !== undefined) updateFields.start_date = parsed.data.start_date
    if (parsed.data.end_date !== undefined) updateFields.end_date = parsed.data.end_date
    if (parsed.data.notes !== undefined) updateFields.notes = parsed.data.notes

    // If start_date is being changed, auto-adjust the previous sub-period's end_date
    if (parsed.data.start_date && parsed.data.start_date !== subPeriod.start_date) {
      // Find the previous sub-period (same budget_period, lower sort_order)
      const [prevSubPeriod] = await db
        .select()
        .from(budgetSubPeriods)
        .where(
          and(
            eq(budgetSubPeriods.budget_period_id, subPeriod.budget_period_id),
            eq(budgetSubPeriods.household_id, householdId),
            lt(budgetSubPeriods.sort_order, subPeriod.sort_order),
          ),
        )
        .orderBy(asc(budgetSubPeriods.sort_order))
        .limit(1)

      if (prevSubPeriod) {
        // Compute new end_date for previous sub-period: day before new start_date
        const newStartDate = new Date(parsed.data.start_date)
        const prevEndDate = new Date(newStartDate)
        prevEndDate.setDate(prevEndDate.getDate() - 1)
        const newPrevEndDate = prevEndDate.toISOString().split('T')[0]

        const oldPrevEndDate = prevSubPeriod.end_date

        // Update the previous sub-period's end_date
        await db
          .update(budgetSubPeriods)
          .set({ end_date: newPrevEndDate })
          .where(eq(budgetSubPeriods.id, prevSubPeriod.id))

        // Audit log for the adjacent sub-period
        await db.insert(periodAuditLog).values({
          budget_sub_period_id: prevSubPeriod.id,
          changed_field: 'end_date',
          old_value: oldPrevEndDate,
          new_value: newPrevEndDate,
          reason: 'Auto-adjusted due to adjacent sub-period start_date change',
          household_id: householdId,
        })
      }

      // Audit log for the target sub-period's start_date change
      await db.insert(periodAuditLog).values({
        budget_sub_period_id: subPeriodId,
        changed_field: 'start_date',
        old_value: subPeriod.start_date,
        new_value: parsed.data.start_date,
        reason: 'Manual sub-period date adjustment',
        household_id: householdId,
      })
    }

    if (parsed.data.end_date && parsed.data.end_date !== subPeriod.end_date) {
      await db.insert(periodAuditLog).values({
        budget_sub_period_id: subPeriodId,
        changed_field: 'end_date',
        old_value: subPeriod.end_date,
        new_value: parsed.data.end_date,
        reason: 'Manual sub-period date adjustment',
        household_id: householdId,
      })
    }

    // Apply the update
    await db
      .update(budgetSubPeriods)
      .set(updateFields)
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] PATCH sub-period error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
