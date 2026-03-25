import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringDismissedSuggestions } from '@/db/schema/recurring'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'

const dismissSchema = z.object({
  fingerprint: z.string().min(1, 'Fingerprint is required'),
})

/**
 * POST /api/recurring/dismiss-suggestion
 *
 * Dismiss a suggestion by its fingerprint.
 * Idempotent — ignores if already dismissed.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = dismissSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { fingerprint } = parsed.data

    // Check if already dismissed
    const [existing] = await db
      .select({ id: recurringDismissedSuggestions.id })
      .from(recurringDismissedSuggestions)
      .where(
        and(
          eq(recurringDismissedSuggestions.fingerprint, fingerprint),
          eq(recurringDismissedSuggestions.household_id, householdId),
        ),
      )
      .limit(1)

    if (!existing) {
      await db.insert(recurringDismissedSuggestions).values({
        fingerprint,
        household_id: householdId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST dismiss-suggestion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
