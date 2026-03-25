import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetSubPeriods } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'

const lockSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/budget/lock
 *
 * Lock a budget sub-period to prevent edits.
 * Sets locked_at timestamp.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = lockSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { subPeriodId } = parsed.data

    // Fetch sub-period
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        locked_at: budgetSubPeriods.locked_at,
      })
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
    if (subPeriod.locked_at) {
      return NextResponse.json({ error: 'Period is already locked' }, { status: 409 })
    }

    await db
      .update(budgetSubPeriods)
      .set({ locked_at: new Date() })
      .where(
        and(
          eq(budgetSubPeriods.id, subPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/lock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
