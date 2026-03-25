import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { householdMembers, transactions } from '@/db/schema/transactions'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateMemberSchema } from '@/lib/validators/members'

/**
 * PATCH /api/members/[id]
 *
 * Updates an existing household member. Scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify member exists in this household
    const [existing] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const updateValues: Record<string, unknown> = {}
    const data = parsed.data
    if (data.name !== undefined) updateValues.name = data.name
    if (data.initials !== undefined) updateValues.initials = data.initials
    if (data.color !== undefined) updateValues.color = data.color
    if (data.sort_order !== undefined) updateValues.sort_order = data.sort_order

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(householdMembers)
      .set(updateValues)
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[members] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/members/[id]
 *
 * Hard-deletes a household member. CRITICAL: checks the transactions table
 * for any references to this member. If any transactions reference this
 * member_id, returns 409 Conflict with the reference count.
 * Scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })
    }

    // Verify member exists in this household
    const [existing] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Check for transaction references — block delete if any exist
    const [refCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.member_id, id),
          eq(transactions.household_id, householdId),
        ),
      )

    if (refCount && refCount.count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete member with existing transactions',
          transaction_count: refCount.count,
        },
        { status: 409 },
      )
    }

    await db
      .delete(householdMembers)
      .where(and(eq(householdMembers.id, id), eq(householdMembers.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[members] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
