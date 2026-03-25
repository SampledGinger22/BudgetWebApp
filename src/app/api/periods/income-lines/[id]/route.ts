import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { periodIncomeLines } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateIncomeLineSchema } from '@/lib/validators/periods'

/**
 * PATCH /api/periods/income-lines/[id]
 *
 * Update an income line.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const lineId = Number(id)
    if (Number.isNaN(lineId)) {
      return NextResponse.json({ error: 'Invalid income line ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateIncomeLineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [existing] = await db
      .select({ id: periodIncomeLines.id })
      .from(periodIncomeLines)
      .where(
        and(
          eq(periodIncomeLines.id, lineId),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Income line not found' }, { status: 404 })
    }

    await db
      .update(periodIncomeLines)
      .set(parsed.data)
      .where(
        and(
          eq(periodIncomeLines.id, lineId),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] PATCH income-line error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/periods/income-lines/[id]
 *
 * Delete an income line.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const lineId = Number(id)
    if (Number.isNaN(lineId)) {
      return NextResponse.json({ error: 'Invalid income line ID' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: periodIncomeLines.id })
      .from(periodIncomeLines)
      .where(
        and(
          eq(periodIncomeLines.id, lineId),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Income line not found' }, { status: 404 })
    }

    await db
      .delete(periodIncomeLines)
      .where(
        and(
          eq(periodIncomeLines.id, lineId),
          eq(periodIncomeLines.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] DELETE income-line error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
