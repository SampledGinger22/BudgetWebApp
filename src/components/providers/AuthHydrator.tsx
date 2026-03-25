'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthStore } from '@/stores/auth-store'
import { usePostHog } from '@/lib/posthog/hooks'

interface AuthHydratorProps {
  children: React.ReactNode
}

/**
 * AuthHydrator — bridges next-auth session into Zustand auth store.
 * On session change, hydrates user + householdId for client-side access.
 * On sign-out (session null), clears the store.
 *
 * PostHog integration: calls posthog.identify() on login and posthog.reset()
 * on logout so analytics events are attributed to the correct user.
 *
 * Observability:
 *   - `useAuthStore.getState()` in browser console shows current auth state.
 *   - PostHog toolbar (dev) shows identified user and active feature flags.
 */
export function AuthHydrator({ children }: AuthHydratorProps): React.ReactNode {
  const { data: session, status } = useSession()
  const posthog = usePostHog()

  useEffect(() => {
    if (status === 'loading') return

    if (session?.user) {
      useAuthStore.getState().setUser(
        {
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.name ?? null,
        },
        session.householdId ?? null,
      )

      // Identify user in PostHog for analytics attribution
      if (posthog) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.name,
        })
      }
    } else {
      useAuthStore.getState().clearUser()

      // Reset PostHog identity on logout to avoid cross-user attribution
      if (posthog) {
        posthog.reset()
      }
    }
  }, [session, status, posthog])

  return children
}
