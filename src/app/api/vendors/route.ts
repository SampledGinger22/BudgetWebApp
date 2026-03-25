import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { vendors, categories } from '@/db/schema/budget'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/require-auth'
import { createVendorSchema } from '@/lib/validators/vendors'

/**
 * GET /api/vendors
 *
 * Lists vendors for the authenticated user's household.
 * LEFT JOINs categories to include default_category_name.
 * Query params:
 *   - includeArchived=true — include archived vendors (default: exclude)
 * Response: Array of vendor objects with default_category_name, ordered by name ASC.
 */
export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    const conditions = [eq(vendors.household_id, householdId)]
    if (!includeArchived) {
      conditions.push(isNull(vendors.archived_at))
    }

    const rows = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        default_category_id: vendors.default_category_id,
        default_category_name: categories.name,
        type: vendors.type,
        archived_at: vendors.archived_at,
        created_at: vendors.created_at,
        household_id: vendors.household_id,
      })
      .from(vendors)
      .leftJoin(categories, eq(vendors.default_category_id, categories.id))
      .where(and(...conditions))
      .orderBy(asc(vendors.name))

    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[vendors] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/vendors
 *
 * Creates a new vendor for the authenticated user's household.
 * Request body: see createVendorSchema
 * Response 201: { id }
 */
export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireAuth()

    const body = await request.json()
    const parsed = createVendorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const [created] = await db
      .insert(vendors)
      .values({
        name: parsed.data.name,
        default_category_id: parsed.data.default_category_id ?? null,
        household_id: householdId,
      })
      .returning()

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[vendors] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
