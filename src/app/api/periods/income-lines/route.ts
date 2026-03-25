import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { periodIncomeLines, budgetSubPeriods } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { addIncomeLineSchema } from '@/lib/validators/periods'

/**
 * POST /api/periods/income-lines
 *
 * Add a new income line to a budget sub-period.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = addIncomeLineSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify sub-period belongs to household
    const [subPeriod] = await db
      .select({ id: budgetSubPeriods.id })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, parsed.data.budget_sub_period_id),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    if (!subPeriod) {
      return NextResponse.json({ error: 'Sub-period not found' }, { status: 404 })
    }

    const [created] = await db
      .insert(periodIncomeLines)
      .values({
        budget_sub_period_id: parsed.data.budget_sub_period_id,
        label: parsed.data.label,
        expected_cents: parsed.data.expected_cents ?? 0,
        actual_cents: parsed.data.actual_cents ?? null,
        category_id: parsed.data.category_id ?? null,
        sort_order: parsed.data.sort_order ?? 0,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST income-line error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
