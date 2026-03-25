import { NextResponse } from 'next/server'
import { db } from '@/db'
import { households } from '@/db/schema/household'
import { users } from '@/db/schema/auth'
import { eq, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/household
 *
 * Returns the current user's household info including member count.
 *
 * Response: { id, name, max_members, owner_id, member_count, created_at }
 *
 * Error responses:
 *   - 401: Not authenticated
 *   - 403: No household associated
 *   - 404: Household not found (defensive — shouldn't happen)
 *   - 500: Internal server error
 */
export async function GET() {
  try {
    const { householdId } = await requireAuth()

    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1)

    if (!household) {
      return NextResponse.json(
        { error: 'Household not found' },
        { status: 404 },
      )
    }

    // Count members in this household
    const [memberResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.household_id, householdId))

    return NextResponse.json({
      id: household.id,
      name: household.name,
      max_members: household.max_members,
      owner_id: household.owner_id,
      member_count: memberResult?.count ?? 0,
      created_at: household.created_at,
    })
  } catch (error) {
    // requireAuth() throws Response objects for 401/403 — pass them through
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to fetch household:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to fetch household' },
      { status: 500 },
    )
  }
}
