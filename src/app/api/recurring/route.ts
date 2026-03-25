import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringTemplates, recurringTemplateDates } from '@/db/schema/recurring'
import { accounts } from '@/db/schema/accounts'
import { categories, vendors } from '@/db/schema/budget'
import { householdMembers } from '@/db/schema/transactions'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createTemplateSchema } from '@/lib/validators/recurring'
import { computeNextDate } from '@/lib/utils/budget-engine'

/**
 * GET /api/recurring
 *
 * Lists all recurring templates for the household, enriched with:
 * - vendor_name, category_name, account_name, member_name via LEFT JOINs
 * - template_dates array (day_values)
 * - next_date computed via computeNextDate()
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    // Fetch templates with related entity names
    const rows = await db
      .select({
        id: recurringTemplates.id,
        name: recurringTemplates.name,
        vendor_id: recurringTemplates.vendor_id,
        amount_cents: recurringTemplates.amount_cents,
        is_debit: recurringTemplates.is_debit,
        category_id: recurringTemplates.category_id,
        account_id: recurringTemplates.account_id,
        member_id: recurringTemplates.member_id,
        type: recurringTemplates.type,
        frequency: recurringTemplates.frequency,
        interval_n: recurringTemplates.interval_n,
        start_date: recurringTemplates.start_date,
        end_date: recurringTemplates.end_date,
        status: recurringTemplates.status,
        auto_confirm: recurringTemplates.auto_confirm,
        notes: recurringTemplates.notes,
        created_at: recurringTemplates.created_at,
        vendor_name: vendors.name,
        category_name: categories.name,
        account_name: accounts.name,
        member_name: householdMembers.name,
      })
      .from(recurringTemplates)
      .leftJoin(vendors, eq(vendors.id, recurringTemplates.vendor_id))
      .leftJoin(categories, eq(categories.id, recurringTemplates.category_id))
      .leftJoin(accounts, eq(accounts.id, recurringTemplates.account_id))
      .leftJoin(householdMembers, eq(householdMembers.id, recurringTemplates.member_id))
      .where(eq(recurringTemplates.household_id, householdId))

    // Fetch all template dates for these templates
    const templateIds = rows.map((r) => r.id)
    let allDates: Array<{ template_id: number; day_value: number; sort_order: number }> = []
    if (templateIds.length > 0) {
      allDates = await db
        .select({
          template_id: recurringTemplateDates.template_id,
          day_value: recurringTemplateDates.day_value,
          sort_order: recurringTemplateDates.sort_order,
        })
        .from(recurringTemplateDates)
        .where(eq(recurringTemplateDates.household_id, householdId))
    }

    // Group dates by template_id
    const datesByTemplate = new Map<number, Array<{ day_value: number; sort_order: number }>>()
    for (const d of allDates) {
      const list = datesByTemplate.get(d.template_id) ?? []
      list.push({ day_value: d.day_value, sort_order: d.sort_order })
      datesByTemplate.set(d.template_id, list)
    }

    // Enrich each template
    const enriched = rows.map((row) => {
      const dates = datesByTemplate.get(row.id) ?? []
      const next_date = row.status === 'active'
        ? computeNextDate(
            {
              frequency: row.frequency,
              interval_n: row.interval_n,
              start_date: row.start_date,
              end_date: row.end_date,
            },
            dates.map((d) => ({ day_value: d.day_value })),
          )
        : null

      return {
        ...row,
        template_dates: dates.sort((a, b) => a.sort_order - b.sort_order),
        next_date,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] GET list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/recurring
 *
 * Create a new recurring template with template_dates.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { day_values, ...templateData } = parsed.data

    // Insert template
    const [template] = await db
      .insert(recurringTemplates)
      .values({
        ...templateData,
        household_id: householdId,
      })
      .returning()

    // Insert template dates
    if (day_values.length > 0) {
      await db.insert(recurringTemplateDates).values(
        day_values.map((dv, i) => ({
          template_id: template.id,
          day_value: dv,
          sort_order: i,
          household_id: householdId,
        })),
      )
    }

    return NextResponse.json({ id: template.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
