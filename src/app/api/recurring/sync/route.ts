import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth/require-auth'
import { generateRecurringEntries } from '@/lib/utils/recurring-engine'
import { z } from 'zod'

const syncSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/recurring/sync
 *
 * Sync (generate) all recurring entries for a sub-period.
 * Delegates to the shared generateRecurringEntries utility.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = syncSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const result = await generateRecurringEntries(db, parsed.data.subPeriodId, householdId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
