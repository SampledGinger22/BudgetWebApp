import { NextResponse } from 'next/server'

/**
 * In-memory IP-based rate limiter using a fixed-window algorithm.
 *
 * Each IP gets a counter that resets after `windowMs` milliseconds.
 * Expired entries are cleaned up on every check call to prevent memory growth.
 *
 * **Production note:** This in-memory implementation resets on Vercel serverless
 * cold starts (~5-15 min idle) and is per-instance (not shared across replicas).
 * For a small household app at launch this is acceptable. For production-grade
 * rate limiting, use `@upstash/ratelimit` with Redis or Vercel WAF.
 *
 * @see https://upstash.com/docs/oss/sdks/ts/ratelimit/overview
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Maximum requests allowed per window */
  maxRequests: number
}

/**
 * Creates an in-memory rate limiter instance.
 *
 * @param options - Configuration for the rate limiter window and threshold
 * @returns Object with a `checkRateLimit` method for IP-based rate checking
 *
 * @example
 * ```ts
 * const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 })
 * const { allowed, retryAfterMs } = limiter.checkRateLimit('192.168.1.1')
 * if (!allowed) {
 *   return getRateLimitResponse(retryAfterMs)
 * }
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests } = options
  const store = new Map<string, RateLimitEntry>()

  function cleanup() {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
  }

  function checkRateLimit(ip: string): RateLimitResult {
    // Clean up expired entries on every call to bound memory
    cleanup()

    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || entry.resetAt <= now) {
      // First request in a new window
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return { allowed: true, retryAfterMs: 0 }
    }

    // Existing window — increment
    entry.count++

    if (entry.count > maxRequests) {
      const retryAfterMs = entry.resetAt - now
      console.warn(
        `[rate-limit] IP exceeded threshold: ${ip} (${entry.count}/${maxRequests} in window, retry after ${Math.ceil(retryAfterMs / 1000)}s)`,
      )
      return { allowed: false, retryAfterMs }
    }

    return { allowed: true, retryAfterMs: 0 }
  }

  return { checkRateLimit }
}

/**
 * Returns a 429 Too Many Requests JSON response with a `Retry-After` header.
 *
 * The `Retry-After` value is in seconds (rounded up) per RFC 7231 §7.1.3.
 *
 * @param retryAfterMs - Milliseconds until the client should retry
 */
export function getRateLimitResponse(retryAfterMs: number): NextResponse {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

/**
 * Pre-configured rate limiter for the registration endpoint.
 * 5 requests per 60 seconds — stricter because registration creates resources.
 */
export const registerLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
})

/**
 * Pre-configured rate limiter for the auth/login endpoint.
 * 10 requests per 60 seconds — more lenient for login attempts.
 */
export const authLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
})
