import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { vendors } from '@/db/schema/budget'
import { eq, and, isNotNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateVendorSchema } from '@/lib/validators/vendors'

/**
 * PATCH /api/vendors/[id]
 *
 * Updates an existing vendor. Scoped by id AND householdId.
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
      return NextResponse.json({ error: 'Invalid vendor id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateVendorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify vendor exists in this household
    const [existing] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const updateValues: Record<string, unknown> = {}
    const data = parsed.data
    if (data.name !== undefined) updateValues.name = data.name
    if (data.default_category_id !== undefined) updateValues.default_category_id = data.default_category_id

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(vendors)
      .set(updateValues)
      .where(and(eq(vendors.id, id), eq(vendors.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[vendors] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/vendors/[id]
 *
 * Hard-deletes a vendor. Pre-condition: vendor must already be archived.
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
      return NextResponse.json({ error: 'Invalid vendor id' }, { status: 400 })
    }

    // Verify vendor exists and is archived
    const [existing] = await db
      .select({ archived_at: vendors.archived_at })
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (!existing.archived_at) {
      return NextResponse.json(
        { error: 'Vendor must be archived before deletion' },
        { status: 400 },
      )
    }

    await db
      .delete(vendors)
      .where(
        and(
          eq(vendors.id, id),
          eq(vendors.household_id, householdId),
          isNotNull(vendors.archived_at),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[vendors] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
