import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringGenerationLog } from '@/db/schema/recurring'
import { transactions } from '@/db/schema/transactions'
import { eq, and, lte, sql, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import dayjs from 'dayjs'

/**
 * GET /api/recurring/unconfirmed-count
 *
 * Count of expected (unconfirmed) recurring entries with scheduled_date ≤ today.
 * Used as a health indicator for the recurring system.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const today = dayjs().format('YYYY-MM-DD')

    // Count generation log entries where:
    // - scheduled_date ≤ today
    // - the linked transaction has recurring_status = 'expected'
    // - not user_deleted
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recurringGenerationLog)
      .innerJoin(
        transactions,
        eq(transactions.id, recurringGenerationLog.transaction_id),
      )
      .where(
        and(
          eq(recurringGenerationLog.household_id, householdId),
          lte(recurringGenerationLog.scheduled_date, today),
          eq(recurringGenerationLog.user_deleted, 0),
          eq(transactions.recurring_status, 'expected'),
          isNull(transactions.voided_at),
        ),
      )

    return NextResponse.json({ count: result?.count ?? 0 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] GET unconfirmed-count error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
