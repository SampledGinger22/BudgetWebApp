import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { importProfiles } from '@/db/schema/imports'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { saveProfileSchema } from '@/lib/validators/imports'

/**
 * GET /api/imports/profiles
 *
 * List all import profiles for the household.
 */
export async function GET() {
  try {
    const { householdId } = await requireAuth()

    const rows = await db
      .select()
      .from(importProfiles)
      .where(eq(importProfiles.household_id, householdId))
      .orderBy(asc(importProfiles.name))

    return NextResponse.json({ data: rows })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] GET profiles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/imports/profiles
 *
 * Save a new import profile.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = saveProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [created] = await db
      .insert(importProfiles)
      .values({
        name: parsed.data.name,
        header_fingerprint: parsed.data.header_fingerprint,
        mapping_json: parsed.data.mapping_json,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] POST profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
