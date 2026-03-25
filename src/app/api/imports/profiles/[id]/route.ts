import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { importProfiles } from '@/db/schema/imports'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { updateProfileSchema } from '@/lib/validators/imports'

/**
 * PATCH /api/imports/profiles/[id]
 *
 * Update an import profile.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const profileId = Number(id)
    if (Number.isNaN(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [existing] = await db
      .select({ id: importProfiles.id })
      .from(importProfiles)
      .where(
        and(
          eq(importProfiles.id, profileId),
          eq(importProfiles.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    await db
      .update(importProfiles)
      .set({ ...parsed.data, updated_at: new Date() })
      .where(
        and(
          eq(importProfiles.id, profileId),
          eq(importProfiles.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] PATCH profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/imports/profiles/[id]
 *
 * Delete an import profile.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const profileId = Number(id)
    if (Number.isNaN(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: importProfiles.id })
      .from(importProfiles)
      .where(
        and(
          eq(importProfiles.id, profileId),
          eq(importProfiles.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    await db
      .delete(importProfiles)
      .where(
        and(
          eq(importProfiles.id, profileId),
          eq(importProfiles.household_id, householdId),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] DELETE profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
