import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { accounts } from '@/db/schema/accounts'
import { budgetSubPeriods } from '@/db/schema/budget'
import { recurringGenerationLog } from '@/db/schema/recurring'
import { eq, and, sql, lte, gte, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateTransactionSchema } from '@/lib/validators/transactions'
import { computeBalanceDelta } from '@/lib/utils/accounting'

/**
 * PATCH /api/transactions/[id]
 *
 * Updates a transaction. Reverses the old balance delta and applies the new one
 * if amount or direction changed. Re-looks up sub-period if date changed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const data = parsed.data

    // Fetch existing transaction + account type
    const [existing] = await db
      .select({
        id: transactions.id,
        account_id: transactions.account_id,
        amount_cents: transactions.amount_cents,
        is_debit: transactions.is_debit,
        date: transactions.date,
        budget_sub_period_id: transactions.budget_sub_period_id,
      })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const [account] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, existing.account_id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Determine new values (fall back to existing)
    const newAmountCents = data.amount_cents ?? existing.amount_cents
    const newIsDebit = data.is_debit ?? existing.is_debit
    const newDate = data.date ?? existing.date

    // If amount or direction changed, reverse old delta and apply new
    const amountOrDirectionChanged =
      data.amount_cents !== undefined || data.is_debit !== undefined
    if (amountOrDirectionChanged) {
      const oldDelta = computeBalanceDelta(existing.amount_cents, existing.is_debit, account.type)
      const newDelta = computeBalanceDelta(newAmountCents, newIsDebit, account.type)
      const netDelta = newDelta - oldDelta

      if (netDelta !== 0) {
        await db
          .update(accounts)
          .set({ balance_cents: sql`${accounts.balance_cents} + ${netDelta}` })
          .where(and(eq(accounts.id, existing.account_id), eq(accounts.household_id, householdId)))
      }
    }

    // Re-lookup sub-period if date changed
    let newSubPeriodId = data.budget_sub_period_id !== undefined
      ? data.budget_sub_period_id
      : existing.budget_sub_period_id

    if (data.date && data.date !== existing.date && data.budget_sub_period_id === undefined) {
      const [subPeriod] = await db
        .select({ id: budgetSubPeriods.id })
        .from(budgetSubPeriods)
        .where(
          and(
            eq(budgetSubPeriods.household_id, householdId),
            lte(budgetSubPeriods.start_date, newDate),
            gte(budgetSubPeriods.end_date, newDate),
          ),
        )
        .limit(1)
      newSubPeriodId = subPeriod?.id ?? null
    }

    // Build update payload
    const updateValues: Record<string, unknown> = {}
    if (data.date !== undefined) updateValues.date = data.date
    if (data.description !== undefined) updateValues.description = data.description
    if (data.amount_cents !== undefined) updateValues.amount_cents = data.amount_cents
    if (data.is_debit !== undefined) updateValues.is_debit = data.is_debit
    if (data.category_id !== undefined) updateValues.category_id = data.category_id
    if (data.vendor_id !== undefined) updateValues.vendor_id = data.vendor_id
    if (data.member_id !== undefined) updateValues.member_id = data.member_id
    if (newSubPeriodId !== existing.budget_sub_period_id) {
      updateValues.budget_sub_period_id = newSubPeriodId
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(transactions)
      .set(updateValues)
      .where(and(eq(transactions.id, id), eq(transactions.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[transactions] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/transactions/[id]
 *
 * Deletes a transaction. If the transaction is in a locked sub-period, soft-voids
 * it (sets voided_at). Otherwise hard-deletes. Always reverses the balance delta.
 * If linked to a recurring template, marks generation_log entry as user_deleted.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 })
    }

    // Fetch existing transaction
    const [existing] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Fetch account for balance delta
    const [account] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, existing.account_id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Check if sub-period is locked
    let isLocked = false
    if (existing.budget_sub_period_id) {
      const [subPeriod] = await db
        .select({ locked_at: budgetSubPeriods.locked_at })
        .from(budgetSubPeriods)
        .where(eq(budgetSubPeriods.id, existing.budget_sub_period_id))
        .limit(1)
      isLocked = !!subPeriod?.locked_at
    }

    // Reverse balance delta (only if not already voided)
    if (!existing.voided_at) {
      const delta = computeBalanceDelta(existing.amount_cents, existing.is_debit, account.type)
      await db
        .update(accounts)
        .set({ balance_cents: sql`${accounts.balance_cents} - ${delta}` })
        .where(and(eq(accounts.id, existing.account_id), eq(accounts.household_id, householdId)))
    }

    if (isLocked) {
      // Soft void — set voided_at
      await db
        .update(transactions)
        .set({ voided_at: new Date() })
        .where(and(eq(transactions.id, id), eq(transactions.household_id, householdId)))
    } else {
      // Hard delete
      await db
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.household_id, householdId)))
    }

    // If linked to recurring template, mark generation_log entry as user_deleted
    if (existing.recurring_template_id) {
      await db
        .update(recurringGenerationLog)
        .set({ user_deleted: 1 })
        .where(
          and(
            eq(recurringGenerationLog.transaction_id, existing.id),
            eq(recurringGenerationLog.household_id, householdId),
          ),
        )
    }

    return NextResponse.json({ success: true, voided: isLocked })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[transactions] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
