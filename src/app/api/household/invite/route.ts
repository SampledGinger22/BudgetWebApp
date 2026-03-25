import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { households, householdInvites } from '@/db/schema/household'
import { users } from '@/db/schema/auth'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * POST /api/household/invite
 *
 * Owner creates an invite for a partner by email.
 *
 * Request body: { email: string }
 *
 * Validations:
 *   - Caller must be the household owner (403 if not)
 *   - Cannot invite yourself (400)
 *   - Cannot exceed max_members including pending invites (409)
 *   - Cannot create duplicate pending invites (409)
 *
 * Response 201: { id, email, status, created_at }
 *
 * Error responses:
 *   - 400: Validation failure or self-invite
 *   - 401: Not authenticated
 *   - 403: Not household owner
 *   - 409: Duplicate invite or household at capacity
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const { user, householdId } = await requireAuth()

    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const email = parsed.data.email.toLowerCase()

    // Verify caller is the household owner
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1)

    if (!household || household.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the household owner can send invites' },
        { status: 403 },
      )
    }

    // Reject self-invite
    if (email === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot invite yourself' },
        { status: 400 },
      )
    }

    // Count current members + pending invites against max_members
    const [memberResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.household_id, householdId))

    const [pendingResult] = await db
      .select({ count: count() })
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.household_id, householdId),
          eq(householdInvites.status, 'pending'),
        ),
      )

    const totalCount =
      (memberResult?.count ?? 0) + (pendingResult?.count ?? 0)

    if (totalCount >= (household.max_members ?? 2)) {
      return NextResponse.json(
        { error: 'Household is at maximum capacity' },
        { status: 409 },
      )
    }

    // Check for existing pending invite with same email + household
    const [existingInvite] = await db
      .select({ id: householdInvites.id })
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.household_id, householdId),
          eq(householdInvites.email, email),
          eq(householdInvites.status, 'pending'),
        ),
      )
      .limit(1)

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Invite already pending' },
        { status: 409 },
      )
    }

    // Create the invite
    const [invite] = await db
      .insert(householdInvites)
      .values({
        household_id: householdId,
        email,
        status: 'pending',
        invited_by: user.id,
      })
      .returning()

    console.log(
      `[household] Invite created: ${invite.id} for ${email} to household ${householdId}`,
    )

    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        created_at: invite.created_at,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to create invite:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/household/invite
 *
 * Returns pending invites for the logged-in user's email.
 * Used by invitees to discover invites after logging in.
 *
 * Response: Array<{ id, household_name, invited_by_name, created_at }>
 *
 * Error responses:
 *   - 401: Not authenticated
 *   - 403: No household associated
 *   - 500: Internal server error
 */
export async function GET() {
  try {
    const { user } = await requireAuth()

    // Find pending invites for this user's email, joined with household name and inviter name
    const pendingInvites = await db
      .select({
        id: householdInvites.id,
        household_name: households.name,
        invited_by_name: users.name,
        created_at: householdInvites.created_at,
      })
      .from(householdInvites)
      .innerJoin(
        households,
        eq(householdInvites.household_id, households.id),
      )
      .leftJoin(users, eq(householdInvites.invited_by, users.id))
      .where(
        and(
          eq(householdInvites.email, user.email.toLowerCase()),
          eq(householdInvites.status, 'pending'),
        ),
      )

    return NextResponse.json(pendingInvites)
  } catch (error) {
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to fetch invites:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 },
    )
  }
}
