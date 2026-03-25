import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema/auth'
import { households } from '@/db/schema/household'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/auth/password'
import { registerLimiter, getRateLimitResponse } from '@/lib/auth/rate-limit'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
})

/**
 * POST /api/auth/register
 *
 * Creates a new user with email/password credentials and auto-creates
 * a household for them. Returns 201 on success.
 *
 * Request body: { email: string, password: string, name: string }
 *
 * Error responses:
 *   - 400: Validation failure (missing or invalid fields)
 *   - 409: Email already registered
 *   - 500: Internal server error (details redacted)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit check — 5 requests per 60 seconds per IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const { allowed, retryAfterMs } = registerLimiter.checkRateLimit(ip)
    if (!allowed) {
      return getRateLimitResponse(retryAfterMs)
    }

    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { email, password, name } = parsed.data

    // Check for existing user with this email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }

    // Hash password with bcrypt + pepper
    const passwordHash = await hashPassword(password)

    // Create household and user atomically:
    // 1. Create the household
    // 2. Create the user linked to the household
    // 3. Set the household owner_id to the user
    const [household] = await db
      .insert(households)
      .values({ name: `${name}'s Budget` })
      .returning()

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        password_hash: passwordHash,
        household_id: household.id,
      })
      .returning()

    await db
      .update(households)
      .set({ owner_id: newUser.id })
      .where(eq(households.id, household.id))

    return NextResponse.json(
      { id: newUser.id, email: newUser.email },
      { status: 201 },
    )
  } catch (error) {
    // Never expose internal error details in API responses
    console.error('[register] Registration failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 },
    )
  }
}
