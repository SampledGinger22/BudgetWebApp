import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { budgetSubPeriods } from '@/db/schema/budget'
import { importBatches } from '@/db/schema/imports'
import { eq, and, lte, gte, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { commitImportSchema } from '@/lib/validators/imports'
import { computeBalanceDelta } from '@/lib/utils/accounting'

/**
 * POST /api/imports/commit
 *
 * Batch commit imported transactions with accumulated balance delta.
 *
 * 1. Create import_batches record
 * 2. For each transaction: look up budget_sub_period_id by date, insert, accumulate delta
 * 3. Apply single balance update to account
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = commitImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { accountId, filename, profileName, format, transactions: txnRows } = parsed.data

    // Fetch account for type (liability-aware delta computation)
    const [account] = await db
      .select({
        id: accounts.id,
        type: accounts.type,
        balance_cents: accounts.balance_cents,
      })
      .from(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)),
      )
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Create import batch record
    const [batch] = await db
      .insert(importBatches)
      .values({
        filename,
        profile_name: profileName ?? null,
        account_id: accountId,
        row_count: txnRows.length,
        format: format ?? 'csv',
        household_id: householdId,
      })
      .returning()

    // Pre-fetch all sub-periods for date lookup (avoids N+1 queries)
    const allSubPeriods = await db
      .select({
        id: budgetSubPeriods.id,
        start_date: budgetSubPeriods.start_date,
        end_date: budgetSubPeriods.end_date,
      })
      .from(budgetSubPeriods)
      .where(eq(budgetSubPeriods.household_id, householdId))

    // Helper: find sub-period for a given date
    function findSubPeriodId(date: string): number | null {
      const match = allSubPeriods.find(
        (sp) => sp.start_date <= date && sp.end_date >= date,
      )
      return match?.id ?? null
    }

    // Insert transactions and accumulate balance delta
    let accumulatedDelta = 0
    let insertedCount = 0

    for (const row of txnRows) {
      const subPeriodId = findSubPeriodId(row.date)
      const delta = computeBalanceDelta(row.amount_cents, row.is_debit, account.type)
      accumulatedDelta += delta

      await db.insert(transactions).values({
        account_id: accountId,
        budget_sub_period_id: subPeriodId,
        date: row.date,
        description: row.description,
        original_description: row.original_description ?? row.description,
        amount_cents: row.amount_cents,
        is_debit: row.is_debit,
        category_id: row.category_id ?? null,
        vendor_id: row.vendor_id ?? null,
        member_id: row.member_id ?? null,
        fitid: row.fitid ?? null,
        import_batch_id: batch.id,
        household_id: householdId,
      })

      insertedCount++
    }

    // Apply accumulated balance delta to the account
    if (accumulatedDelta !== 0) {
      await db
        .update(accounts)
        .set({
          balance_cents: sql`${accounts.balance_cents} + ${accumulatedDelta}`,
        })
        .where(
          and(eq(accounts.id, accountId), eq(accounts.household_id, householdId)),
        )
    }

    return NextResponse.json({
      batchId: batch.id,
      insertedCount,
      balanceDeltaCents: accumulatedDelta,
    })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] POST commit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
