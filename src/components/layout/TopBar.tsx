'use client'

import { Layout, Typography } from 'antd'
import { COLORS } from '@/theme'

const { Header } = Layout
const { Title } = Typography

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

export function TopBar({ title, actions }: TopBarProps): React.JSX.Element {
  return (
    <Header
      style={{
        backgroundColor: COLORS.cream,
        borderBottom: `1px solid rgba(169, 85, 55, 0.15)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 52,
        lineHeight: '52px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Title
        level={4}
        style={{
          margin: 0,
          color: COLORS.walnut,
          fontWeight: 600,
          fontSize: 16,
          lineHeight: '52px',
        }}
      >
        {title}
      </Title>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </Header>
  )
}

export default TopBar
