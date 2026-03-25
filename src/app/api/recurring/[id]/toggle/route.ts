import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringTemplates } from '@/db/schema/recurring'
import { accounts } from '@/db/schema/accounts'
import { categories, vendors } from '@/db/schema/budget'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/recurring/[id]/toggle
 *
 * Toggle template status between active and paused.
 * When toggling to active, validates that referenced account, category,
 * and vendor are not archived. Returns 200 with { error } on validation
 * failure (matching Electron behavior — not a thrown error).
 */
export async function POST(
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

    // Fetch template
    const [template] = await db
      .select()
      .from(recurringTemplates)
      .where(
        and(eq(recurringTemplates.id, templateId), eq(recurringTemplates.household_id, householdId)),
      )
      .limit(1)

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const newStatus = template.status === 'active' ? 'paused' : 'active'

    // Validate references when activating
    if (newStatus === 'active') {
      // Check account is not archived
      const [account] = await db
        .select({ id: accounts.id, archived_at: accounts.archived_at })
        .from(accounts)
        .where(
          and(eq(accounts.id, template.account_id), eq(accounts.household_id, householdId)),
        )
        .limit(1)

      if (!account) {
        return NextResponse.json({
          error: 'Referenced account no longer exists',
        })
      }
      if (account.archived_at) {
        return NextResponse.json({
          error: 'Referenced account is archived. Unarchive it before activating this template.',
        })
      }

      // Check category is not archived (if set)
      if (template.category_id) {
        const [category] = await db
          .select({ id: categories.id, archived_at: categories.archived_at })
          .from(categories)
          .where(eq(categories.id, template.category_id))
          .limit(1)

        if (!category) {
          return NextResponse.json({
            error: 'Referenced category no longer exists',
          })
        }
        if (category.archived_at) {
          return NextResponse.json({
            error: 'Referenced category is archived. Unarchive it before activating this template.',
          })
        }
      }

      // Check vendor is not archived (if set)
      if (template.vendor_id) {
        const [vendor] = await db
          .select({ id: vendors.id, archived_at: vendors.archived_at })
          .from(vendors)
          .where(eq(vendors.id, template.vendor_id))
          .limit(1)

        if (!vendor) {
          return NextResponse.json({
            error: 'Referenced vendor no longer exists',
          })
        }
        if (vendor.archived_at) {
          return NextResponse.json({
            error: 'Referenced vendor is archived. Unarchive it before activating this template.',
          })
        }
      }
    }

    // Toggle status
    await db
      .update(recurringTemplates)
      .set({ status: newStatus })
      .where(eq(recurringTemplates.id, templateId))

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST toggle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
