import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { accounts } from '@/db/schema/accounts'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { reorderSchema } from '@/lib/validators/accounts'

/**
 * POST /api/accounts/reorder
 *
 * Reorders accounts by setting sort_order = index for each id in the array.
 * Sequential updates without db.transaction() (neon-http constraint).
 * Idempotent and low-frequency — race window is acceptable.
 *
 * Request body: { ids: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { ids } = parsed.data

    // Sequential updates — no db.transaction() available with neon-http
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(accounts)
        .set({ sort_order: i })
        .where(and(eq(accounts.id, ids[i]), eq(accounts.household_id, householdId)))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[accounts] reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
