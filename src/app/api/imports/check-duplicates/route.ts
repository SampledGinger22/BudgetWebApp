import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkDuplicatesSchema } from '@/lib/validators/imports'

/**
 * POST /api/imports/check-duplicates
 *
 * Check a list of candidate transactions for potential duplicates in the database.
 * Matches on (account_id, date, description, amount_cents, is_debit).
 * Returns an array of booleans (same order as input) indicating which are duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = checkDuplicatesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { accountId, transactions: candidates } = parsed.data

    // Build duplicate check for each candidate
    const results: boolean[] = []

    for (const candidate of candidates) {
      const [match] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.account_id, accountId),
            eq(transactions.household_id, householdId),
            eq(transactions.date, candidate.date),
            eq(transactions.description, candidate.description),
            eq(transactions.amount_cents, candidate.amount_cents),
            eq(transactions.is_debit, candidate.is_debit),
          ),
        )
        .limit(1)

      results.push(!!match)
    }

    return NextResponse.json({ duplicates: results })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[imports] POST check-duplicates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
