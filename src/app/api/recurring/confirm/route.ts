import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { confirmSchema } from '@/lib/validators/recurring'
import { computeBalanceDelta } from '@/lib/utils/accounting'

/**
 * POST /api/recurring/confirm
 *
 * Confirm a single recurring transaction. If actualAmountCents differs
 * from the current amount, adjusts the account balance by the delta difference.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { transactionId, actualAmountCents } = parsed.data

    // Fetch the transaction
    const [txn] = await db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.household_id, householdId)),
      )
      .limit(1)

    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Fetch account for type
    const [account] = await db
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, txn.account_id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const newAmount = actualAmountCents ?? txn.amount_cents

    // If the amount changed, adjust balance
    if (newAmount !== txn.amount_cents) {
      // Reverse old delta and apply new delta
      const oldDelta = computeBalanceDelta(txn.amount_cents, txn.is_debit, account.type)
      const newDelta = computeBalanceDelta(newAmount, txn.is_debit, account.type)
      const adjustment = newDelta - oldDelta

      await db
        .update(accounts)
        .set({ balance_cents: sql`${accounts.balance_cents} + ${adjustment}` })
        .where(eq(accounts.id, txn.account_id))
    }

    // Update transaction: confirmed status + new amount
    await db
      .update(transactions)
      .set({
        recurring_status: 'confirmed',
        amount_cents: newAmount,
        estimated_amount_cents: txn.amount_cents,
      })
      .where(eq(transactions.id, transactionId))

    return NextResponse.json({ success: true, amount_cents: newAmount })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST confirm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
