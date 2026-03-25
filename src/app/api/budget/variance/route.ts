import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  budgetSubPeriods,
} from '@/db/schema/budget'
import { recurringTemplates, recurringTemplateDates } from '@/db/schema/recurring'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { computeOccurrences } from '@/lib/utils/budget-engine'
import { z } from 'zod'

const varianceQuerySchema = z.object({
  subPeriodId: z.coerce.number().int(),
})

/**
 * GET /api/budget/variance?subPeriodId=X
 *
 * Returns per-category budget variance with:
 *  - initial_budget_cents (allocated)
 *  - net_transfers_cents (incoming minus outgoing transfers)
 *  - total_spent_cents (sum of transactions)
 *  - remaining_cents (budget + transfers - spent)
 *  - expected_cents (from active recurring templates via computeOccurrences)
 *  - member_spend (per-member breakdown of spending)
 *
 * Uses raw SQL with CTEs for the main query, then enriches with
 * recurring projections and member spend in application code.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = varianceQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { subPeriodId } = parsed.data

    // Fetch the sub-period to get date range
    const [subPeriod] = await db
      .select({
        id: budgetSubPeriods.id,
        start_date: budgetSubPeriods.start_date,
        end_date: budgetSubPeriods.end_date,
        surplus_carry_forward_cents: budgetSubPeriods.surplus_carry_forward_cents,
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

    // Main variance query using raw SQL with CTEs
    const varianceRows = await db.execute(sql`
      WITH net_xfers AS (
        SELECT
          bt.from_category_id AS category_id,
          -SUM(bt.amount_cents) AS net_cents
        FROM budget_transfers bt
        WHERE bt.budget_sub_period_id = ${subPeriodId}
          AND bt.household_id = ${householdId}
        GROUP BY bt.from_category_id
        UNION ALL
        SELECT
          bt.to_category_id AS category_id,
          SUM(bt.amount_cents) AS net_cents
        FROM budget_transfers bt
        WHERE bt.budget_sub_period_id = ${subPeriodId}
          AND bt.household_id = ${householdId}
        GROUP BY bt.to_category_id
      ),
      net_xfers_agg AS (
        SELECT category_id, SUM(net_cents) AS net_transfer_cents
        FROM net_xfers
        GROUP BY category_id
      ),
      income_by_cat AS (
        SELECT
          pil.category_id,
          SUM(pil.expected_cents) AS income_cents
        FROM period_income_lines pil
        WHERE pil.budget_sub_period_id = ${subPeriodId}
          AND pil.household_id = ${householdId}
          AND pil.category_id IS NOT NULL
        GROUP BY pil.category_id
      ),
      spent AS (
        SELECT
          t.category_id,
          SUM(
            CASE WHEN t.is_debit = 1 THEN t.amount_cents ELSE -t.amount_cents END
          ) AS spent_cents
        FROM transactions t
        WHERE t.budget_sub_period_id = ${subPeriodId}
          AND t.household_id = ${householdId}
          AND t.voided_at IS NULL
        GROUP BY t.category_id
      )
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.parent_id,
        cg.id AS category_group_id,
        cg.name AS category_group_name,
        cg.sort_order AS group_sort_order,
        c.sort_order AS category_sort_order,
        COALESCE(ba.allocated_cents, 0) AS initial_budget_cents,
        COALESCE(nx.net_transfer_cents, 0) AS net_transfers_cents,
        COALESCE(ic.income_cents, 0) AS income_cents,
        COALESCE(s.spent_cents, 0) AS total_spent_cents,
        COALESCE(ba.allocated_cents, 0) + COALESCE(nx.net_transfer_cents, 0) - COALESCE(s.spent_cents, 0) AS remaining_cents
      FROM categories c
      INNER JOIN category_groups cg ON cg.id = c.category_group_id
      LEFT JOIN budget_allocations ba
        ON ba.category_id = c.id
        AND ba.budget_sub_period_id = ${subPeriodId}
        AND ba.household_id = ${householdId}
      LEFT JOIN net_xfers_agg nx ON nx.category_id = c.id
      LEFT JOIN income_by_cat ic ON ic.category_id = c.id
      LEFT JOIN spent s ON s.category_id = c.id
      WHERE c.household_id = ${householdId}
        AND c.archived_at IS NULL
      ORDER BY cg.sort_order, c.sort_order
    `)

    // Cast the raw result to typed rows
    const rows = varianceRows.rows as Array<{
      category_id: number
      category_name: string
      parent_id: number | null
      category_group_id: number
      category_group_name: string
      group_sort_order: number
      category_sort_order: number
      initial_budget_cents: number
      net_transfers_cents: number
      income_cents: number
      total_spent_cents: number
      remaining_cents: number
    }>

    // Compute expected_cents from active recurring templates
    const activeTemplates = await db
      .select({
        id: recurringTemplates.id,
        frequency: recurringTemplates.frequency,
        interval_n: recurringTemplates.interval_n,
        start_date: recurringTemplates.start_date,
        end_date: recurringTemplates.end_date,
        amount_cents: recurringTemplates.amount_cents,
        is_debit: recurringTemplates.is_debit,
        category_id: recurringTemplates.category_id,
      })
      .from(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.household_id, householdId),
          eq(recurringTemplates.status, 'active'),
        ),
      )

    // Fetch template dates for all active templates
    const templateIds = activeTemplates.map((t) => t.id)
    let templateDatesMap: Map<number, Array<{ day_value: number }>> = new Map()

    if (templateIds.length > 0) {
      const allDates = await db
        .select({
          template_id: recurringTemplateDates.template_id,
          day_value: recurringTemplateDates.day_value,
        })
        .from(recurringTemplateDates)
        .where(
          sql`${recurringTemplateDates.template_id} IN (${sql.join(
            templateIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )

      for (const d of allDates) {
        if (!templateDatesMap.has(d.template_id)) {
          templateDatesMap.set(d.template_id, [])
        }
        templateDatesMap.get(d.template_id)!.push({ day_value: d.day_value })
      }
    }

    // Compute expected per category
    const expectedByCat: Record<number, number> = {}
    for (const tmpl of activeTemplates) {
      if (!tmpl.category_id) continue
      const dates = templateDatesMap.get(tmpl.id) ?? []
      if (dates.length === 0) continue

      const occurrences = computeOccurrences(
        {
          frequency: tmpl.frequency,
          interval_n: tmpl.interval_n,
          start_date: tmpl.start_date,
          end_date: tmpl.end_date,
        },
        dates,
        subPeriod.start_date,
        subPeriod.end_date,
      )

      const expectedTotal = occurrences.length * tmpl.amount_cents
      expectedByCat[tmpl.category_id] = (expectedByCat[tmpl.category_id] ?? 0) + expectedTotal
    }

    // Member spend breakdown per category
    const memberSpendRows = await db.execute(sql`
      SELECT
        t.category_id,
        t.member_id,
        hm.name AS member_name,
        hm.initials AS member_initials,
        SUM(
          CASE WHEN t.is_debit = 1 THEN t.amount_cents ELSE -t.amount_cents END
        ) AS spent_cents
      FROM transactions t
      LEFT JOIN household_members hm ON hm.id = t.member_id
      WHERE t.budget_sub_period_id = ${subPeriodId}
        AND t.household_id = ${householdId}
        AND t.voided_at IS NULL
        AND t.member_id IS NOT NULL
      GROUP BY t.category_id, t.member_id, hm.name, hm.initials
    `)

    const memberSpendByCat: Record<
      number,
      Array<{ member_id: number; member_name: string | null; member_initials: string | null; spent_cents: number }>
    > = {}
    for (const row of memberSpendRows.rows as Array<{
      category_id: number
      member_id: number
      member_name: string | null
      member_initials: string | null
      spent_cents: number
    }>) {
      if (!row.category_id) continue
      if (!memberSpendByCat[row.category_id]) {
        memberSpendByCat[row.category_id] = []
      }
      memberSpendByCat[row.category_id].push({
        member_id: row.member_id,
        member_name: row.member_name,
        member_initials: row.member_initials,
        spent_cents: Number(row.spent_cents),
      })
    }

    // Combine results
    const data = rows.map((row) => ({
      category_id: row.category_id,
      category_name: row.category_name,
      parent_id: row.parent_id,
      category_group_id: row.category_group_id,
      category_group_name: row.category_group_name,
      group_sort_order: row.group_sort_order,
      category_sort_order: row.category_sort_order,
      initial_budget_cents: Number(row.initial_budget_cents),
      net_transfers_cents: Number(row.net_transfers_cents),
      income_cents: Number(row.income_cents),
      total_spent_cents: Number(row.total_spent_cents),
      remaining_cents: Number(row.remaining_cents),
      expected_cents: expectedByCat[row.category_id] ?? 0,
      member_spend: memberSpendByCat[row.category_id] ?? [],
    }))

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] GET /api/budget/variance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
