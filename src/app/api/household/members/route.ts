import { NextResponse } from 'next/server'
import { db } from '@/db'
import { households } from '@/db/schema/household'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * GET /api/household/members
 *
 * Returns users in the caller's household. Only safe fields are exposed —
 * password_hash and other sensitive columns are never included.
 *
 * Response: Array<{ id, email, name, is_owner }>
 *
 * Error responses:
 *   - 401: Not authenticated
 *   - 403: No household associated
 *   - 500: Internal server error
 */
export async function GET() {
  try {
    const { householdId } = await requireAuth()

    // Look up the household owner_id for is_owner computation
    const [household] = await db
      .select({ owner_id: households.owner_id })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1)

    // Explicit safe column selection — never expose password_hash
    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.household_id, householdId))

    const result = members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name,
      is_owner: member.id === household?.owner_id,
    }))

    return NextResponse.json(result)
  } catch (error) {
    // requireAuth() throws Response objects for 401/403 — pass them through
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to fetch members:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to fetch household members' },
      { status: 500 },
    )
  }
}
