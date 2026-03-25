import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { accounts } from '@/db/schema/accounts'
import { eq, and, isNotNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateAccountSchema } from '@/lib/validators/accounts'

/**
 * PATCH /api/accounts/[id]
 *
 * Updates an existing account. Handles opening_balance_cents delta:
 * if opening_balance_cents changes, balance_cents is adjusted by the same delta.
 * All queries scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Read current account for opening_balance delta calculation
    const [existing] = await db
      .select({
        opening_balance_cents: accounts.opening_balance_cents,
        balance_cents: accounts.balance_cents,
      })
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Build update values from validated fields
    const updateValues: Record<string, unknown> = {}
    const data = parsed.data
    if (data.name !== undefined) updateValues.name = data.name
    if (data.type !== undefined) updateValues.type = data.type
    if (data.as_of_date !== undefined) updateValues.as_of_date = data.as_of_date
    if (data.credit_limit_cents !== undefined) updateValues.credit_limit_cents = data.credit_limit_cents
    if (data.interest_rate_basis_points !== undefined) updateValues.interest_rate_basis_points = data.interest_rate_basis_points
    if (data.minimum_payment_cents !== undefined) updateValues.minimum_payment_cents = data.minimum_payment_cents
    if (data.statement_date !== undefined) updateValues.statement_date = data.statement_date
    if (data.interest_date !== undefined) updateValues.interest_date = data.interest_date

    // Opening balance delta logic: adjust balance_cents by the same amount
    if (data.opening_balance_cents !== undefined) {
      const oldOpening = existing.opening_balance_cents
      const newOpening = data.opening_balance_cents
      const delta = newOpening - oldOpening
      updateValues.opening_balance_cents = newOpening
      updateValues.balance_cents = existing.balance_cents + delta
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(accounts)
      .set(updateValues)
      .where(and(eq(accounts.id, id), eq(accounts.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/accounts/[id]
 *
 * Hard-deletes an account. Pre-condition: account must already be archived.
 * Returns 400 if not archived. Scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid account id' }, { status: 400 })
    }

    // Verify account exists and is archived
    const [existing] = await db
      .select({ archived_at: accounts.archived_at })
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!existing.archived_at) {
      return NextResponse.json(
        { error: 'Account must be archived before deletion' },
        { status: 400 },
      )
    }

    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.household_id, householdId),
          isNotNull(accounts.archived_at),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
