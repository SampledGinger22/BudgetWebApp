import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { accounts } from '@/db/schema/accounts'
import { eq, and, isNull, asc, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAccountSchema } from '@/lib/validators/accounts'

/**
 * GET /api/accounts
 *
 * Lists accounts for the authenticated user's household.
 * Query params:
 *   - includeArchived=true — include archived accounts (default: exclude)
 * Response: Array of account objects, ordered by sort_order ASC, id ASC.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    const conditions = [eq(accounts.household_id, householdId)]
    if (!includeArchived) {
      conditions.push(isNull(accounts.archived_at))
    }

    const rows = await db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .orderBy(asc(accounts.sort_order), asc(accounts.id))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/accounts
 *
 * Creates a new account for the authenticated user's household.
 * Auto-assigns sort_order via COALESCE(MAX(sort_order), -1) + 1.
 * Request body: see createAccountSchema
 * Response 201: { id }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Auto sort_order: one higher than current max for this household
    const [maxResult] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${accounts.sort_order}), -1)` })
      .from(accounts)
      .where(eq(accounts.household_id, householdId))

    const nextSortOrder = (maxResult?.maxSort ?? -1) + 1

    const openingBalanceCents = parsed.data.opening_balance_cents ?? 0

    const [created] = await db
      .insert(accounts)
      .values({
        name: parsed.data.name,
        type: parsed.data.type,
        opening_balance_cents: openingBalanceCents,
        balance_cents: openingBalanceCents,
        as_of_date: parsed.data.as_of_date,
        credit_limit_cents: parsed.data.credit_limit_cents,
        interest_rate_basis_points: parsed.data.interest_rate_basis_points,
        minimum_payment_cents: parsed.data.minimum_payment_cents,
        statement_date: parsed.data.statement_date,
        interest_date: parsed.data.interest_date,
        sort_order: nextSortOrder,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
