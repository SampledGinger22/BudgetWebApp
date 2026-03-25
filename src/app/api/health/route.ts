import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

/**
 * GET /api/health — Unauthenticated health check endpoint.
 *
 * Returns deployment health status with optional DB connectivity check.
 * Used by Vercel health probes, uptime monitors, and deployment pipelines.
 *
 * - Does NOT use requireAuth() — must be publicly accessible.
 * - Returns HTTP 200 even when DB is unreachable (status: 'degraded')
 *   because a degraded app is still running and accepting traffic.
 */
export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({
      status: 'ok',
      timestamp,
      db: 'connected',
    })
  } catch {
    return NextResponse.json({
      status: 'degraded',
      timestamp,
      db: 'unreachable',
    })
  }
}
