import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings } from '@/db/schema/transactions'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { settingsGetSchema, settingsSetSchema } from '@/lib/validators/settings'

/**
 * GET /api/settings?key=<key>
 *
 * Returns the value for a given settings key, scoped to the user's household.
 * Response: { key: string, value: string | null } or { value: null } if not found.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const key = request.nextUrl.searchParams.get('key')
    const parsed = settingsGetSchema.safeParse({ key })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [setting] = await db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(
        and(
          eq(appSettings.key, parsed.data.key),
          eq(appSettings.household_id, householdId),
        ),
      )
      .limit(1)

    return NextResponse.json(setting ?? { key: parsed.data.key, value: null })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[settings] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings
 *
 * Upserts a setting key/value pair for the user's household.
 * Request body: { key: string, value: string }
 * Response 200: { key, value }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = settingsSetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { key, value } = parsed.data

    const [result] = await db
      .insert(appSettings)
      .values({
        key,
        value,
        household_id: householdId,
      })
      .onConflictDoUpdate({
        target: [appSettings.key, appSettings.household_id],
        set: { value: sql`excluded.value` },
      })
      .returning()

    return NextResponse.json({ key: result.key, value: result.value })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[settings] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
