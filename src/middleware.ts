import { NextResponse } from 'next/server'
import { postHogMiddleware } from '@posthog/next'

const handler = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? postHogMiddleware({ proxy: true })
  : () => NextResponse.next()

export default handler

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
