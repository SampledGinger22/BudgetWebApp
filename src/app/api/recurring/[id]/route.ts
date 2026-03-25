import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringTemplates, recurringTemplateDates } from '@/db/schema/recurring'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateTemplateSchema } from '@/lib/validators/recurring'

/**
 * PATCH /api/recurring/[id]
 *
 * Update a recurring template. If day_values is provided, replaces all template_dates.
 */
export async function PATCH(
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

    const body = await request.json()
    const parsed = updateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Check template exists and belongs to household
    const [existing] = await db
      .select({ id: recurringTemplates.id })
      .from(recurringTemplates)
      .where(
        and(eq(recurringTemplates.id, templateId), eq(recurringTemplates.household_id, householdId)),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const { day_values, ...updateData } = parsed.data

    // Update template fields (if any provided)
    if (Object.keys(updateData).length > 0) {
      await db
        .update(recurringTemplates)
        .set(updateData)
        .where(eq(recurringTemplates.id, templateId))
    }

    // Replace template dates if provided
    if (day_values && day_values.length > 0) {
      await db
        .delete(recurringTemplateDates)
        .where(eq(recurringTemplateDates.template_id, templateId))

      await db.insert(recurringTemplateDates).values(
        day_values.map((dv, i) => ({
          template_id: templateId,
          day_value: dv,
          sort_order: i,
          household_id: householdId,
        })),
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] PATCH update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/recurring/[id]
 *
 * Hard delete a recurring template. CASCADE deletes template_dates and generation_log.
 */
export async function DELETE(
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

    // Check template exists and belongs to household
    const [existing] = await db
      .select({ id: recurringTemplates.id })
      .from(recurringTemplates)
      .where(
        and(eq(recurringTemplates.id, templateId), eq(recurringTemplates.household_id, householdId)),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // CASCADE deletes dates + log entries
    await db
      .delete(recurringTemplates)
      .where(eq(recurringTemplates.id, templateId))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
