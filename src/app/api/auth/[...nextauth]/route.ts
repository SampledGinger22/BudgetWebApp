import { NextRequest } from 'next/server'
import { handlers } from '@/auth'
import { authLimiter, getRateLimitResponse } from '@/lib/auth/rate-limit'

// GET handler is unwrapped — session checks and CSRF token fetches should not be rate limited
export const { GET } = handlers

/**
 * POST handler wraps the Auth.js POST with IP-based rate limiting.
 * Only POST requests (login/sign-in attempts) are rate limited.
 * GET requests (session, CSRF, providers) pass through directly.
 */
export async function POST(request: NextRequest) {
  // Rate limit check — 10 requests per 60 seconds per IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { allowed, retryAfterMs } = authLimiter.checkRateLimit(ip)
  if (!allowed) {
    return getRateLimitResponse(retryAfterMs)
  }

  // Delegate to Auth.js handler
  return handlers.POST(request)
}
