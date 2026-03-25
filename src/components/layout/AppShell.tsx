'use client'

import { useEffect } from 'react'
import { Layout, message } from 'antd'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PeriodCloseBanner } from '@/components/budget/PeriodCloseBanner'
import { RecurringConfirmBanner } from '@/components/recurring/RecurringConfirmBanner'
import { useRegeneratePeriods } from '@/lib/api/periods'
import { COLORS } from '@/theme'

const { Content } = Layout

function derivePageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Dashboard'
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  const titleMap: Record<string, string> = {
    accounts: 'Accounts',
    budget: 'Budget',
    vendors: 'Payees',
    settings: 'Settings',
    'pay-schedule': 'Pay Schedule',
    categories: 'Categories',
    transactions: 'Transactions',
    reports: 'Reports',
    import: 'Import',
    recurring: 'Recurring',
    members: 'Members',
    notifications: 'Notifications',
    household: 'Household',
    account: 'Account',
  }
  return titleMap[last] ?? last.charAt(0).toUpperCase() + last.slice(1)
}

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname()
  const pageTitle = derivePageTitle(pathname)
  const regeneratePeriods = useRegeneratePeriods()

  // Auto-generate upcoming periods on app launch
  useEffect(() => {
    regeneratePeriods.mutate(undefined, {
        onSuccess: () => {
          // Period generation is silent — TanStack Query cache invalidation
          // handles refreshing period lists across the app
        },
        onError: () => {
          // Non-critical: silent failure — periods will be generated on next manual action
        },
      },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar — rendered first in DOM for correct tab order */}
      <div id="sidebar-nav">
        <Sidebar />
      </div>

      {/* Main area: TopBar + banner + scrollable content */}
      <Layout style={{ flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title={pageTitle} />

        {/* Period close/lock reminder banner — renders conditionally */}
        <PeriodCloseBanner />

        {/* Recurring confirmation banner — shows when past-due unconfirmed entries exist */}
        <RecurringConfirmBanner />

        <Content
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            backgroundColor: COLORS.cream,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppShell
