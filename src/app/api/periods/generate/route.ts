import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  budgetPeriods,
  budgetSubPeriods,
  periodIncomeLines,
  paySchedules,
  budgetAllocations,
} from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, gte, lte, or } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { generatePeriodsSchema } from '@/lib/validators/periods'
import { computePeriodBoundaries } from '@/lib/utils/budget-engine'
import { generateRecurringEntries } from '@/lib/utils/recurring-engine'

/**
 * POST /api/periods/generate
 *
 * Generate budget periods from a pay schedule.
 * Uses computePeriodBoundaries for all 5 schedule types.
 *
 * For each month in range:
 * 1. Compute period/sub-period boundaries
 * 2. Skip if overlapping period is customized or has allocations/transactions
 * 3. Delete non-customized empty overlapping period
 * 4. Insert new budget_period + budget_sub_periods
 * 5. Seed income lines from active pay schedule
 * After loop: backfill income lines for existing sub-periods with zero income entries
 *
 * NOTE: The generateRecurringEntries() call is stubbed — T05 will wire it in.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = generatePeriodsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { scheduleId, year, month, count } = parsed.data
    const monthsAhead = count ?? 3

    // Fetch the schedule
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

    const createdPeriodIds: number[] = []
    const createdSubPeriodIds: number[] = []

    // Generate for each month
    for (let i = 0; i < monthsAhead; i++) {
      const targetMonth = ((month - 1 + i) % 12) + 1
      const targetYear = year + Math.floor((month - 1 + i) / 12)

      // Compute boundaries for this month
      const boundaries = computePeriodBoundaries(schedule, targetYear, targetMonth)
      if (!boundaries) continue

      const { periodStart, periodEnd, subPeriods } = boundaries

      // Check for overlapping existing periods
      const overlapping = await db
        .select({
          id: budgetPeriods.id,
          is_customized: budgetPeriods.is_customized,
        })
        .from(budgetPeriods)
        .where(
          and(
            eq(budgetPeriods.household_id, householdId),
            lte(budgetPeriods.start_date, periodEnd),
            gte(budgetPeriods.end_date, periodStart),
          ),
        )

      let skipPeriod = false

      for (const existing of overlapping) {
        // Skip if customized
        if (existing.is_customized === 1) {
          skipPeriod = true
          break
        }

        // Check if period has allocations
        const existingSubPeriods = await db
          .select({ id: budgetSubPeriods.id })
          .from(budgetSubPeriods)
          .where(eq(budgetSubPeriods.budget_period_id, existing.id))

        const existingSubIds = existingSubPeriods.map((sp) => sp.id)

        if (existingSubIds.length > 0) {
          // Check for allocations
          const [allocCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(budgetAllocations)
            .where(
              and(
                sql`${budgetAllocations.budget_sub_period_id} IN (${sql.join(
                  existingSubIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`,
                eq(budgetAllocations.household_id, householdId),
              ),
            )

          if ((allocCount?.count ?? 0) > 0) {
            skipPeriod = true
            break
          }

          // Check for transactions
          const [txnCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
              and(
                sql`${transactions.budget_sub_period_id} IN (${sql.join(
                  existingSubIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`,
                eq(transactions.household_id, householdId),
              ),
            )

          if ((txnCount?.count ?? 0) > 0) {
            skipPeriod = true
            break
          }
        }

        // Non-customized, empty — delete it
        // First delete income lines for its sub-periods
        for (const subId of existingSubIds) {
          await db
            .delete(periodIncomeLines)
            .where(eq(periodIncomeLines.budget_sub_period_id, subId))
        }
        // Sub-periods cascade on delete from budget_periods
        await db.delete(budgetPeriods).where(eq(budgetPeriods.id, existing.id))
      }

      if (skipPeriod) continue

      // Insert new budget_period
      const [newPeriod] = await db
        .insert(budgetPeriods)
        .values({
          pay_schedule_id: scheduleId,
          start_date: periodStart,
          end_date: periodEnd,
          is_customized: 0,
          household_id: householdId,
        })
        .returning()

      createdPeriodIds.push(newPeriod.id)

      // Insert sub-periods
      for (let s = 0; s < subPeriods.length; s++) {
        const sp = subPeriods[s]
        const [newSubPeriod] = await db
          .insert(budgetSubPeriods)
          .values({
            budget_period_id: newPeriod.id,
            start_date: sp.startDate,
            end_date: sp.endDate,
            sort_order: s,
            household_id: householdId,
          })
          .returning()

        createdSubPeriodIds.push(newSubPeriod.id)

        // Seed income line from schedule (if schedule has amount)
        if (schedule.amount_cents && schedule.amount_cents > 0) {
          await db.insert(periodIncomeLines).values({
            budget_sub_period_id: newSubPeriod.id,
            label: schedule.name,
            expected_cents: schedule.amount_cents,
            category_id: schedule.income_category_id ?? null,
            sort_order: 0,
            household_id: householdId,
          })
        }
      }
    }

    // Backfill income lines for existing sub-periods with zero income entries
    const allSubPeriods = await db
      .select({ id: budgetSubPeriods.id })
      .from(budgetSubPeriods)
      .where(eq(budgetSubPeriods.household_id, householdId))

    for (const sp of allSubPeriods) {
      const [incomeCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(periodIncomeLines)
        .where(eq(periodIncomeLines.budget_sub_period_id, sp.id))

      if ((incomeCount?.count ?? 0) === 0 && schedule.amount_cents && schedule.amount_cents > 0) {
        await db.insert(periodIncomeLines).values({
          budget_sub_period_id: sp.id,
          label: schedule.name,
          expected_cents: schedule.amount_cents,
          category_id: schedule.income_category_id ?? null,
          sort_order: 0,
          household_id: householdId,
        })
      }
    }

    // Generate recurring entries for each new sub-period
    for (const subPeriodId of createdSubPeriodIds) {
      await generateRecurringEntries(db, subPeriodId, householdId)
    }

    return NextResponse.json({
      createdPeriods: createdPeriodIds.length,
      createdSubPeriods: createdSubPeriodIds.length,
      periodIds: createdPeriodIds,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[periods] POST generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
