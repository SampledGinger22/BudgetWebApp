import { auth } from '@/auth'

/**
 * Next.js 16 route protection proxy.
 *
 * Runs before every matched request. Auth.js's `auth()` wrapper
 * augments the request with `req.auth` (the JWT session) so we
 * can make redirect decisions without a DB round-trip.
 *
 * Observability:
 *   - Set AUTH_DEBUG=true to see proxy-level session checks in server logs.
 *   - Authenticated users hitting /login or /register are redirected to /.
 *   - Unauthenticated users hitting any non-auth page are redirected to /login.
 *   - /api/auth/* routes are always allowed through (Auth.js needs them).
 */
export default auth((req) => {
  const isAuth = !!req.auth
  const { pathname } = req.nextUrl

  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register')
  const isApiAuth = pathname.startsWith('/api/auth')

  // Always allow Auth.js API routes through
  if (isApiAuth) return

  // Redirect authenticated users away from login/register pages
  if (isAuth && isAuthPage) {
    return Response.redirect(new URL('/', req.nextUrl.origin))
  }

  // Redirect unauthenticated users to login (except auth pages)
  if (!isAuth && !isAuthPage) {
    return Response.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
