import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema/transactions'
import { recurringTemplates, recurringDismissedSuggestions } from '@/db/schema/recurring'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/recurring/suggestions
 *
 * Pattern-based suggestions from transaction history.
 * Aggregates non-templated transactions by description:
 * - Filters by count ≥ 3
 * - Amount similarity within 20% (max amount ≤ 1.2 × min amount)
 * - Excludes descriptions matching existing template names
 * - Excludes dismissed fingerprints
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    // Aggregate transactions: group by description, compute count and amount stats
    // Only consider non-templated, non-voided transactions
    const aggregated = await db
      .select({
        description: transactions.description,
        count: sql<number>`count(*)::int`,
        avg_amount_cents: sql<number>`round(avg(${transactions.amount_cents}))::int`,
        min_amount_cents: sql<number>`min(${transactions.amount_cents})::int`,
        max_amount_cents: sql<number>`max(${transactions.amount_cents})::int`,
        is_debit: sql<number>`mode() WITHIN GROUP (ORDER BY ${transactions.is_debit})`,
        account_id: sql<number>`mode() WITHIN GROUP (ORDER BY ${transactions.account_id})`,
        category_id: sql<number | null>`mode() WITHIN GROUP (ORDER BY ${transactions.category_id})`,
        vendor_id: sql<number | null>`mode() WITHIN GROUP (ORDER BY ${transactions.vendor_id})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.household_id, householdId),
          isNull(transactions.recurring_template_id),
          isNull(transactions.voided_at),
        ),
      )
      .groupBy(transactions.description)
      .having(sql`count(*) >= 3`)

    if (aggregated.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Filter by amount similarity: max ≤ 1.2 × min
    const similar = aggregated.filter((row) => {
      if (row.min_amount_cents === 0) return false
      return row.max_amount_cents <= row.min_amount_cents * 1.2
    })

    // Get existing template names to exclude
    const existingTemplates = await db
      .select({ name: recurringTemplates.name })
      .from(recurringTemplates)
      .where(eq(recurringTemplates.household_id, householdId))

    const existingNames = new Set(existingTemplates.map((t) => t.name.toLowerCase()))

    // Get dismissed fingerprints
    const dismissed = await db
      .select({ fingerprint: recurringDismissedSuggestions.fingerprint })
      .from(recurringDismissedSuggestions)
      .where(eq(recurringDismissedSuggestions.household_id, householdId))

    const dismissedSet = new Set(dismissed.map((d) => d.fingerprint))

    // Filter and build suggestions
    const suggestions = similar
      .filter((row) => {
        // Exclude if name matches existing template
        if (existingNames.has(row.description.toLowerCase())) return false
        // Exclude if fingerprint is dismissed
        const fingerprint = `${row.description}:${row.account_id}`
        if (dismissedSet.has(fingerprint)) return false
        return true
      })
      .map((row) => ({
        description: row.description,
        count: row.count,
        avg_amount_cents: row.avg_amount_cents,
        min_amount_cents: row.min_amount_cents,
        max_amount_cents: row.max_amount_cents,
        is_debit: row.is_debit,
        account_id: row.account_id,
        category_id: row.category_id,
        vendor_id: row.vendor_id,
        fingerprint: `${row.description}:${row.account_id}`,
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ data: suggestions })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] GET suggestions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
