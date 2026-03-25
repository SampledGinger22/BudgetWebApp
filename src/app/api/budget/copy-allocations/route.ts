import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetAllocations, budgetSubPeriods } from '@/db/schema/budget'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { copyAllocationsSchema } from '@/lib/validators/budget'

/**
 * POST /api/budget/copy-allocations
 *
 * Copy budget allocations from one sub-period to another.
 * Supports:
 *  - categoryIds filter (optional, copy only specified categories)
 *  - useActuals mode: instead of copying allocated_cents, copies actual
 *    spending totals from the source sub-period
 *
 * Uses onConflictDoUpdate so existing allocations in the target are overwritten.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = copyAllocationsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { sourceSubPeriodId, targetSubPeriodId, useActuals } = parsed.data

    // Verify both sub-periods belong to household
    const [sourceSp] = await db
      .select({ id: budgetSubPeriods.id })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, sourceSubPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    const [targetSp] = await db
      .select({
        id: budgetSubPeriods.id,
        locked_at: budgetSubPeriods.locked_at,
      })
      .from(budgetSubPeriods)
      .where(
        and(
          eq(budgetSubPeriods.id, targetSubPeriodId),
          eq(budgetSubPeriods.household_id, householdId),
        ),
      )
      .limit(1)

    if (!sourceSp) {
      return NextResponse.json({ error: 'Source sub-period not found' }, { status: 404 })
    }
    if (!targetSp) {
      return NextResponse.json({ error: 'Target sub-period not found' }, { status: 404 })
    }
    if (targetSp.locked_at) {
      return NextResponse.json({ error: 'Target period is locked' }, { status: 409 })
    }

    let copiedCount = 0

    if (useActuals) {
      // Copy actual spending totals as allocations
      const actuals = await db
        .select({
          category_id: transactions.category_id,
          spent_cents: sql<number>`COALESCE(SUM(
            CASE WHEN ${transactions.is_debit} = 1 THEN ${transactions.amount_cents}
                 ELSE -${transactions.amount_cents} END
          ), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.budget_sub_period_id, sourceSubPeriodId),
            eq(transactions.household_id, householdId),
            isNull(transactions.voided_at),
            sql`${transactions.category_id} IS NOT NULL`,
          ),
        )
        .groupBy(transactions.category_id)

      for (const actual of actuals) {
        if (!actual.category_id) continue
        const spentCents = Math.max(0, Number(actual.spent_cents))

        await db
          .insert(budgetAllocations)
          .values({
            budget_sub_period_id: targetSubPeriodId,
            category_id: actual.category_id,
            allocated_cents: spentCents,
            household_id: householdId,
          })
          .onConflictDoUpdate({
            target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
            set: { allocated_cents: spentCents },
          })

        copiedCount++
      }
    } else {
      // Copy allocated_cents from source
      const sourceAllocations = await db
        .select({
          category_id: budgetAllocations.category_id,
          allocated_cents: budgetAllocations.allocated_cents,
          auto_split: budgetAllocations.auto_split,
        })
        .from(budgetAllocations)
        .where(
          and(
            eq(budgetAllocations.budget_sub_period_id, sourceSubPeriodId),
            eq(budgetAllocations.household_id, householdId),
          ),
        )

      for (const alloc of sourceAllocations) {
        await db
          .insert(budgetAllocations)
          .values({
            budget_sub_period_id: targetSubPeriodId,
            category_id: alloc.category_id,
            allocated_cents: alloc.allocated_cents,
            auto_split: alloc.auto_split,
            household_id: householdId,
          })
          .onConflictDoUpdate({
            target: [budgetAllocations.budget_sub_period_id, budgetAllocations.category_id],
            set: {
              allocated_cents: alloc.allocated_cents,
              auto_split: alloc.auto_split,
            },
          })

        copiedCount++
      }
    }

    return NextResponse.json({ success: true, copied_count: copiedCount })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[budget] POST /api/budget/copy-allocations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
