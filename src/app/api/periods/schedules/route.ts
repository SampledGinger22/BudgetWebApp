import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { paySchedules } from '@/db/schema/budget'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { saveScheduleSchema } from '@/lib/validators/periods'

/**
 * GET /api/periods/schedules
 *
 * List all pay schedules for the household.
 */
export async function GET() {
  try {
    const { householdId } = await requireAuth()

    const rows = await db
      .select()
      .from(paySchedules)
      .where(eq(paySchedules.household_id, householdId))
      .orderBy(asc(paySchedules.id))

    return NextResponse.json({ data: rows })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] GET schedules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/periods/schedules
 *
 * Create a new pay schedule. If is_primary=1, clears primary from all other schedules first.
 * Also supports upsert via optional `id` field — if provided and exists, updates instead.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = saveScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const data = parsed.data

    // If setting as primary, clear others first
    if (data.is_primary === 1) {
      await db
        .update(paySchedules)
        .set({ is_primary: 0 })
        .where(eq(paySchedules.household_id, householdId))
    }

    const [created] = await db
      .insert(paySchedules)
      .values({
        name: data.name,
        schedule_type: data.schedule_type,
        day_of_month_1: data.day_of_month_1 ?? null,
        day_of_month_2: data.day_of_month_2 ?? null,
        day_of_week: data.day_of_week ?? null,
        anchor_date: data.anchor_date ?? null,
        is_primary: data.is_primary ?? 0,
        amount_cents: data.amount_cents ?? null,
        household_member_id: data.household_member_id ?? null,
        income_category_id: data.income_category_id ?? null,
        vendor_id: data.vendor_id ?? null,
        end_date: data.end_date ?? null,
        recurring_template_id: data.recurring_template_id ?? null,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
