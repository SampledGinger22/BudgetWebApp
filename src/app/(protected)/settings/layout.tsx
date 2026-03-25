'use client'

import { Tabs } from 'antd'
import { usePathname, useRouter } from 'next/navigation'

const settingsTabs = [
  { key: '/settings/pay-schedule', label: 'Pay Schedule' },
  { key: '/settings/categories', label: 'Categories' },
  { key: '/settings/members', label: 'Members' },
  { key: '/settings/notifications', label: 'Notifications' },
  { key: '/settings/household', label: 'Household' },
  { key: '/settings/account', label: 'Account' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter()
  const pathname = usePathname()

  const activeKey = settingsTabs.find((t) => pathname.startsWith(t.key))?.key ?? settingsTabs[0].key

  return (
    <div>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => router.push(key)}
        items={settingsTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
        style={{ marginBottom: 16 }}
      />
      {children}
    </div>
  )
}
