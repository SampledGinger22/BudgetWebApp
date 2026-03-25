import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Authenticated user context returned by `requireAuth()`.
 * Every protected API route destructures this to get the user and their householdId.
 */
export interface AuthContext {
  user: { id: string; email: string; name: string | null }
  householdId: number
}

/**
 * Require an authenticated session and return the user's AuthContext.
 *
 * Usage in an API route handler:
 * ```ts
 * const { user, householdId } = await requireAuth()
 * // all DB queries filter by householdId
 * ```
 *
 * @throws Response with 401 if no valid session exists
 * @throws Response with 403 if the user has no associated household
 */
export async function requireAuth(): Promise<AuthContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Prefer householdId from session cache (injected by session callback),
  // fall back to DB lookup if the session callback didn't populate it.
  let householdId = (session as any).householdId as number | null

  if (!householdId) {
    const [dbUser] = await db
      .select({ household_id: users.household_id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    householdId = dbUser?.household_id ?? null
  }

  if (!householdId) {
    throw new Response(
      JSON.stringify({ error: 'No household associated with user' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name ?? null,
    },
    householdId,
  }
}
