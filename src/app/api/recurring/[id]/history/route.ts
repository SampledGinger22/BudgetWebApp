import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringGenerationLog } from '@/db/schema/recurring'
import { transactions } from '@/db/schema/transactions'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/recurring/[id]/history
 *
 * Generation history for a specific recurring template.
 * Returns log entries with associated transaction details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const templateId = parseInt(id, 10)
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
    }

    const rows = await db
      .select({
        id: recurringGenerationLog.id,
        template_id: recurringGenerationLog.template_id,
        budget_sub_period_id: recurringGenerationLog.budget_sub_period_id,
        scheduled_date: recurringGenerationLog.scheduled_date,
        transaction_id: recurringGenerationLog.transaction_id,
        user_deleted: recurringGenerationLog.user_deleted,
        created_at: recurringGenerationLog.created_at,
        txn_amount_cents: transactions.amount_cents,
        txn_recurring_status: transactions.recurring_status,
        txn_voided_at: transactions.voided_at,
      })
      .from(recurringGenerationLog)
      .leftJoin(transactions, eq(transactions.id, recurringGenerationLog.transaction_id))
      .where(
        and(
          eq(recurringGenerationLog.template_id, templateId),
          eq(recurringGenerationLog.household_id, householdId),
        ),
      )
      .orderBy(desc(recurringGenerationLog.scheduled_date))

    return NextResponse.json({ data: rows })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] GET history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
