import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ProtectedShell } from '@/components/layout/ProtectedShell'

/**
 * Protected route layout — server-side session check.
 * Redirects unauthenticated users to /login.
 * Wraps children in ProtectedShell (AuthHydrator + AppShell with sidebar/topbar/banners).
 *
 * Observability: If a user is redirected, Auth.js debug mode (AUTH_DEBUG=true)
 * logs the session check. The proxy.ts also handles unauthenticated redirects
 * for defense-in-depth.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')
  return <ProtectedShell>{children}</ProtectedShell>
}
