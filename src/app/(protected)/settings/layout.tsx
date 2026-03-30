'use client'

import { Tabs } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const settingsTabs = [
  { key: '/settings/pay-schedule', label: 'Pay Schedule' },
  { key: '/settings/categories', label: 'Categories' },
  { key: '/settings/members', label: 'Members' },
  { key: '/settings/notifications', label: 'Notifications' },
  { key: '/settings/household', label: 'Household' },
  { key: '/settings/account', label: 'Account' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()

  const activeKey = settingsTabs.find((t) => pathname.startsWith(t.key))?.key ?? settingsTabs[0].key

  return (
    <div>
      <Tabs
        activeKey={activeKey}
        items={settingsTabs.map((tab) => ({
          key: tab.key,
          label: <Link href={tab.key} prefetch={true} style={{ color: 'inherit' }}>{tab.label}</Link>,
        }))}
        style={{ marginBottom: 16 }}
      />
      {children}
    </div>
  )
}
