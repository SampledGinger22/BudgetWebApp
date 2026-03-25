import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { householdMembers } from '@/db/schema/transactions'
import { eq, and, isNull, asc, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createMemberSchema } from '@/lib/validators/members'

/**
 * GET /api/members
 *
 * Lists household members for the authenticated user's household.
 * Query params:
 *   - includeArchived=true — include archived members (default: exclude)
 * Response: Array of member objects, ordered by sort_order ASC, id ASC.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    const conditions = [eq(householdMembers.household_id, householdId)]
    if (!includeArchived) {
      conditions.push(isNull(householdMembers.archived_at))
    }

    const rows = await db
      .select()
      .from(householdMembers)
      .where(and(...conditions))
      .orderBy(asc(householdMembers.sort_order), asc(householdMembers.id))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[members] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/members
 *
 * Creates a new household member.
 * Auto-assigns sort_order via COALESCE(MAX(sort_order), -1) + 1 scoped to
 * active (non-archived) members in the household.
 * Request body: see createMemberSchema
 * Response 201: { id }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    // Auto sort_order: one higher than current max among active members for this household
    const [maxResult] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${householdMembers.sort_order}), -1)` })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.household_id, householdId),
          isNull(householdMembers.archived_at),
        ),
      )

    const nextSortOrder = (maxResult?.maxSort ?? -1) + 1

    const [created] = await db
      .insert(householdMembers)
      .values({
        name: parsed.data.name,
        initials: parsed.data.initials,
        color: parsed.data.color,
        sort_order: nextSortOrder,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[members] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
