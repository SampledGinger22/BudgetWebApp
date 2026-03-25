'use client'

import { AuthHydrator } from '@/components/providers/AuthHydrator'
import { AppShell } from '@/components/layout/AppShell'

interface ProtectedShellProps {
  children: React.ReactNode
}

/**
 * Client-side wrapper composing AuthHydrator + AppShell.
 * Used by the server-side protected layout after auth check.
 */
export function ProtectedShell({ children }: ProtectedShellProps): React.JSX.Element {
  return (
    <AuthHydrator>
      <AppShell>{children}</AppShell>
    </AuthHydrator>
  )
}
