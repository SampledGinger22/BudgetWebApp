'use client'

import { Badge, Layout, Menu, Typography } from 'antd'
import {
  DashboardOutlined,
  WalletOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BankOutlined,
  TeamOutlined,
  SettingOutlined,
  RetweetOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { COLORS } from '@/theme'
import { useUIStore } from '@/stores/ui-store'
import { useUnconfirmedCount } from '@/lib/api/recurring'

const { Sider } = Layout
const { Text } = Typography

interface MenuItem {
  key: string
  icon: React.ReactNode
  label: string
  path: string
}

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    path: '/',
  },
  {
    key: 'accounts',
    icon: <BankOutlined />,
    label: 'Accounts',
    path: '/accounts',
  },
  {
    key: 'budget',
    icon: <WalletOutlined />,
    label: 'Budget',
    path: '/budget',
  },
  {
    key: 'transactions',
    icon: <UnorderedListOutlined />,
    label: 'Transactions',
    path: '/transactions',
  },
  {
    key: 'recurring',
    icon: <RetweetOutlined />,
    label: 'Recurring',
    path: '/recurring',
  },
  {
    key: 'import',
    icon: <ImportOutlined />,
    label: 'Import',
    path: '/import',
  },
  {
    key: 'vendors',
    icon: <TeamOutlined />,
    label: 'Payees',
    path: '/vendors',
  },
  {
    key: 'reports',
    icon: <BarChartOutlined />,
    label: 'Reports',
    path: '/reports',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Settings',
    path: '/settings/pay-schedule',
  },
]

export function Sidebar(): React.JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUIStore()

  // TanStack Query auto-refetches based on staleTime — no manual polling needed
  const { data: unconfirmedData } = useUnconfirmedCount()
  const unconfirmedCount = unconfirmedData?.count ?? 0

  // Derive selected key from current pathname
  const selectedKey =
    pathname === '/' ? 'dashboard' : pathname.split('/')[1] ?? 'dashboard'

  const toggleIcon = collapsed ? (
    <MenuUnfoldOutlined
      onClick={toggleSidebar}
      style={{ fontSize: 18, cursor: 'pointer', color: COLORS.terracotta }}
      aria-label="Expand sidebar"
    />
  ) : (
    <MenuFoldOutlined
      onClick={toggleSidebar}
      style={{ fontSize: 18, cursor: 'pointer', color: COLORS.terracotta }}
      aria-label="Collapse sidebar"
    />
  )

  const antMenuItems = menuItems.map((item) => {
    // Add unconfirmed count badge to the Recurring nav item
    const icon =
      item.key === 'recurring' ? (
        <Badge count={unconfirmedCount} size="small" offset={[6, 0]}>
          <RetweetOutlined />
        </Badge>
      ) : (
        item.icon
      )

    return {
      key: item.key,
      icon,
      label: item.label,
    }
  })

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      collapsedWidth={64}
      style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        overflow: 'auto',
        backgroundColor: COLORS.creamDark,
        transition: 'width 0.2s ease',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand / header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '16px 0' : '16px 20px',
          borderBottom: `1px solid rgba(169, 85, 55, 0.15)`,
          minHeight: 56,
        }}
      >
        {!collapsed && (
          <Text
            strong
            style={{
              color: COLORS.walnut,
              fontSize: 15,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            PersonalBudget
          </Text>
        )}
        {toggleIcon}
      </div>

      {/* Navigation menu */}
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        inlineCollapsed={collapsed}
        onClick={({ key }) => {
          const item = menuItems.find((m) => m.key === key)
          if (item) router.push(item.path)
        }}
        items={antMenuItems}
        style={{
          backgroundColor: COLORS.creamDark,
          border: 'none',
          marginTop: 8,
        }}
      />
    </Sider>
  )
}

export default Sidebar
