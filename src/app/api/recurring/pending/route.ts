import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringTemplates, recurringTemplateDates, recurringGenerationLog } from '@/db/schema/recurring'
import { accounts } from '@/db/schema/accounts'
import { categories, vendors } from '@/db/schema/budget'
import { householdMembers } from '@/db/schema/transactions'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { computeOccurrences } from '@/lib/utils/budget-engine'
import dayjs from 'dayjs'

/**
 * GET /api/recurring/pending
 *
 * Returns pending recurring entries for an account:
 * - Projects template occurrences from 30 days ago to 5 days ahead
 * - Filters out already-generated entries
 * - Categorizes as past_due, due_today, or upcoming
 *
 * Query params: accountId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const accountId = request.nextUrl.searchParams.get('accountId')
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const accountIdNum = parseInt(accountId, 10)
    if (isNaN(accountIdNum)) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 })
    }

    const today = dayjs().format('YYYY-MM-DD')
    const rangeStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const rangeEnd = dayjs().add(5, 'day').format('YYYY-MM-DD')

    // Fetch active templates for this account
    const templates = await db
      .select()
      .from(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.household_id, householdId),
          eq(recurringTemplates.account_id, accountIdNum),
          eq(recurringTemplates.status, 'active'),
        ),
      )

    if (templates.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const templateIds = templates.map((t) => t.id)

    // Fetch template dates
    const allDates = await db
      .select()
      .from(recurringTemplateDates)
      .where(inArray(recurringTemplateDates.template_id, templateIds))

    const datesByTemplate = new Map<number, Array<{ day_value: number }>>()
    for (const d of allDates) {
      const list = datesByTemplate.get(d.template_id) ?? []
      list.push({ day_value: d.day_value })
      datesByTemplate.set(d.template_id, list)
    }

    // Fetch existing generation log entries in this range
    const logEntries = await db
      .select({
        template_id: recurringGenerationLog.template_id,
        scheduled_date: recurringGenerationLog.scheduled_date,
      })
      .from(recurringGenerationLog)
      .where(eq(recurringGenerationLog.household_id, householdId))

    const loggedSet = new Set(logEntries.map((l) => `${l.template_id}:${l.scheduled_date}`))

    // Fetch enrichment data
    const enrichmentMap = new Map<number, { vendor_name: string | null; category_name: string | null; member_name: string | null }>()
    for (const t of templates) {
      let vendor_name = null
      let category_name = null
      let member_name = null

      if (t.vendor_id) {
        const [v] = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, t.vendor_id)).limit(1)
        vendor_name = v?.name ?? null
      }
      if (t.category_id) {
        const [c] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, t.category_id)).limit(1)
        category_name = c?.name ?? null
      }
      if (t.member_id) {
        const [m] = await db.select({ name: householdMembers.name }).from(householdMembers).where(eq(householdMembers.id, t.member_id)).limit(1)
        member_name = m?.name ?? null
      }

      enrichmentMap.set(t.id, { vendor_name, category_name, member_name })
    }

    // Project occurrences and categorize
    const pendingEntries: Array<{
      template_id: number
      template_name: string
      date: string
      amount_cents: number
      is_debit: number
      category: string | null
      vendor: string | null
      member: string | null
      status: 'past_due' | 'due_today' | 'upcoming'
    }> = []

    for (const template of templates) {
      const tDates = datesByTemplate.get(template.id) ?? []
      if (tDates.length === 0) continue

      const occurrences = computeOccurrences(
        {
          frequency: template.frequency,
          interval_n: template.interval_n,
          start_date: template.start_date,
          end_date: template.end_date,
        },
        tDates,
        rangeStart,
        rangeEnd,
      )

      const enrichment = enrichmentMap.get(template.id)

      for (const dateStr of occurrences) {
        // Skip already-generated
        if (loggedSet.has(`${template.id}:${dateStr}`)) continue

        let status: 'past_due' | 'due_today' | 'upcoming'
        if (dateStr < today) {
          status = 'past_due'
        } else if (dateStr === today) {
          status = 'due_today'
        } else {
          status = 'upcoming'
        }

        pendingEntries.push({
          template_id: template.id,
          template_name: template.name,
          date: dateStr,
          amount_cents: template.amount_cents,
          is_debit: template.is_debit,
          category: enrichment?.category_name ?? null,
          vendor: enrichment?.vendor_name ?? null,
          member: enrichment?.member_name ?? null,
          status,
        })
      }
    }

    // Sort by date
    pendingEntries.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ data: pendingEntries })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] GET pending error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
