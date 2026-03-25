import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkFitidSchema } from '@/lib/validators/imports'

/**
 * POST /api/imports/check-fitid
 *
 * Check a list of FITIDs for duplicates against existing transactions.
 * Returns the set of FITIDs that already exist in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = checkFitidSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { accountId, fitids } = parsed.data

    // Find existing FITIDs
    const existing = await db
      .select({ fitid: transactions.fitid })
      .from(transactions)
      .where(
        and(
          eq(transactions.account_id, accountId),
          eq(transactions.household_id, householdId),
          inArray(transactions.fitid, fitids),
        ),
      )

    const existingFitids = existing
      .map((r) => r.fitid)
      .filter((f): f is string => f !== null)

    return NextResponse.json({ existingFitids })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] POST check-fitid error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
