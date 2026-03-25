import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { households, householdInvites } from '@/db/schema/household'
import { users } from '@/db/schema/auth'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

const acceptSchema = z.object({
  invite_id: z.number().int().positive(),
})

/**
 * POST /api/household/invite/accept
 *
 * Accept a pending household invite. Updates the invite status to 'accepted'
 * and moves the user into the new household. Handles orphaned household
 * cleanup if the user's old household becomes empty.
 *
 * Request body: { invite_id: number }
 *
 * Sequential queries (no db.transaction — neon-http constraint):
 *   1. Update invite status to 'accepted' (WHERE status = 'pending')
 *   2. Update user's household_id to the invite's household
 *   3. If old household is now empty, delete it
 *
 * Idempotent: re-accepting an already-accepted invite returns 200.
 *
 * Error responses:
 *   - 400: Validation failure or invite was declined
 *   - 401: Not authenticated
 *   - 403: No household associated
 *   - 404: Invite not found or not for this user
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const body = await request.json()
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { invite_id } = parsed.data

    // Look up the invite
    const [invite] = await db
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.id, invite_id))
      .limit(1)

    if (!invite || invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 },
      )
    }

    // Idempotent: already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json({
        household_id: invite.household_id,
        message: 'Already accepted',
      })
    }

    // Cannot accept a declined invite
    if (invite.status === 'declined') {
      return NextResponse.json(
        { error: 'Invite was declined' },
        { status: 400 },
      )
    }

    // Sequential queries — no transaction (neon-http constraint)

    // 1. Update invite status to 'accepted' WHERE status = 'pending'
    //    If 0 rows affected, another request beat us — return idempotent 200
    const updated = await db
      .update(householdInvites)
      .set({ status: 'accepted' })
      .where(
        and(
          eq(householdInvites.id, invite_id),
          eq(householdInvites.status, 'pending'),
        ),
      )
      .returning()

    if (updated.length === 0) {
      // Race condition: another request accepted this invite first
      return NextResponse.json({
        household_id: invite.household_id,
        message: 'Already accepted',
      })
    }

    // 2. Save the user's current household_id before changing it
    const [currentUser] = await db
      .select({ household_id: users.household_id })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const oldHouseholdId = currentUser?.household_id

    // 3. Update user's household_id to the invite's household
    await db
      .update(users)
      .set({ household_id: invite.household_id })
      .where(eq(users.id, user.id))

    // 4. Clean up orphaned old household if empty
    if (
      oldHouseholdId &&
      oldHouseholdId !== invite.household_id
    ) {
      const [remainingMembers] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.household_id, oldHouseholdId))

      if ((remainingMembers?.count ?? 0) === 0) {
        await db
          .delete(households)
          .where(eq(households.id, oldHouseholdId))

        console.log(
          `[household] Deleted orphaned household ${oldHouseholdId} after user ${user.id} accepted invite ${invite_id}`,
        )
      }
    }

    console.log(
      `[household] Invite ${invite_id} accepted: user ${user.id} joined household ${invite.household_id}`,
    )

    return NextResponse.json({
      household_id: invite.household_id,
      message: 'Invite accepted',
    })
  } catch (error) {
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to accept invite:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 },
    )
  }
}
