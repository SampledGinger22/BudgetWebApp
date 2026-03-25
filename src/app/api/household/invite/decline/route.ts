import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { householdInvites } from '@/db/schema/household'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'

const declineSchema = z.object({
  invite_id: z.number().int().positive(),
})

/**
 * POST /api/household/invite/decline
 *
 * Decline a pending household invite. Updates the invite status to 'declined'.
 *
 * Request body: { invite_id: number }
 *
 * Idempotent: re-declining an already-declined invite returns 200.
 *
 * Error responses:
 *   - 400: Validation failure
 *   - 401: Not authenticated
 *   - 403: No household associated
 *   - 404: Invite not found or not for this user
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()

    const body = await request.json()
    const parsed = declineSchema.safeParse(body)
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

    // Idempotent: already declined
    if (invite.status === 'declined') {
      return NextResponse.json({ message: 'Invite declined' })
    }

    // Update status to 'declined' WHERE status = 'pending'
    await db
      .update(householdInvites)
      .set({ status: 'declined' })
      .where(
        and(
          eq(householdInvites.id, invite_id),
          eq(householdInvites.status, 'pending'),
        ),
      )

    console.log(
      `[household] Invite ${invite_id} declined by user ${user.id}`,
    )

    return NextResponse.json({ message: 'Invite declined' })
  } catch (error) {
    if (error instanceof Response) throw error

    console.error(
      '[household] Failed to decline invite:',
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: 'Failed to decline invite' },
      { status: 500 },
    )
  }
}
