import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories } from '@/db/schema/budget'
import { eq, and, ne } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateCategorySchema } from '@/lib/validators/categories'

/**
 * PATCH /api/categories/[id]
 *
 * Updates an existing category's name and/or ref_number.
 * If ref_number is provided, validates uniqueness scoped to household (exclude self).
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
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Verify category exists in this household
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const updateValues: Record<string, unknown> = {}
    const data = parsed.data

    if (data.name !== undefined) updateValues.name = data.name

    if (data.ref_number !== undefined) {
      if (data.ref_number === null) {
        updateValues.ref_number = null
      } else {
        // Validate uniqueness scoped to household (exclude self)
        const [collision] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.ref_number, data.ref_number),
              eq(categories.household_id, householdId),
              ne(categories.id, id),
            ),
          )
          .limit(1)

        if (collision) {
          return NextResponse.json(
            { error: 'ref_number already in use within this household' },
            { status: 409 },
          )
        }
        updateValues.ref_number = data.ref_number
      }
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    await db
      .update(categories)
      .set(updateValues)
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/categories/[id]
 *
 * Hard-deletes a category and its sub-categories.
 * Cascade: delete sub-categories first (WHERE parent_id = id), then delete the category.
 * Sequential queries without db.transaction() (neon-http constraint).
 * Scoped by householdId.
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
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
    }

    // Verify category exists in this household
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Step 1: delete sub-categories first (cascade)
    await db
      .delete(categories)
      .where(
        and(
          eq(categories.parent_id, id),
          eq(categories.household_id, householdId),
        ),
      )

    // Step 2: delete the category itself
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[categories] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
