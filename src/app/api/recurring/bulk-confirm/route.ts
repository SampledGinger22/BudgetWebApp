import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { bulkConfirmSchema } from '@/lib/validators/recurring'

/**
 * POST /api/recurring/bulk-confirm
 *
 * Confirm multiple recurring transactions at their current amounts.
 * No balance adjustment needed since amounts don't change.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = bulkConfirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { transactionIds } = parsed.data

    // Verify all transactions belong to this household and are recurring
    const txns = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          inArray(transactions.id, transactionIds),
          eq(transactions.household_id, householdId),
        ),
      )

    const foundIds = new Set(txns.map((t) => t.id))
    const missingIds = transactionIds.filter((id) => !foundIds.has(id))
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some transactions not found', missingIds },
        { status: 404 },
      )
    }

    // Confirm all at current amounts
    let confirmedCount = 0
    for (const txnId of transactionIds) {
      await db
        .update(transactions)
        .set({ recurring_status: 'confirmed' })
        .where(
          and(
            eq(transactions.id, txnId),
            eq(transactions.household_id, householdId),
          ),
        )
      confirmedCount++
    }

    return NextResponse.json({ success: true, confirmedCount })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST bulk-confirm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
