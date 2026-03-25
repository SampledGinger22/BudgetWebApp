import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth/require-auth'
import { generateForOneTemplate } from '@/lib/utils/recurring-engine'
import { z } from 'zod'

const generateOneSchema = z.object({
  subPeriodId: z.number().int(),
})

/**
 * POST /api/recurring/[id]/generate
 *
 * Generate entries for a single recurring template in a specific sub-period.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { householdId } = await requireAuth()
    const { id } = await params
    const templateId = parseInt(id, 10)
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = generateOneSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const result = await generateForOneTemplate(
      db,
      templateId,
      parsed.data.subPeriodId,
      householdId,
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[recurring] POST generate-one error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
