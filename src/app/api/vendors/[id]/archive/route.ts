import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { vendors } from '@/db/schema/budget'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * POST /api/vendors/[id]/archive
 *
 * Sets archived_at = now() on the vendor.
 * Scoped by id AND householdId.
 */
export async function POST(
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

    const [existing] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.household_id, householdId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    await db
      .update(vendors)
      .set({ archived_at: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.household_id, householdId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[vendors] archive error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
