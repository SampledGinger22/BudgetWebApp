'use client'

import { Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { COLORS } from '@/theme'

const { Text } = Typography

export interface ChecklistItemProps {
  done: boolean
  label: string
  href: string
  icon: React.ReactNode
  onClick?: () => void
}

export function ChecklistItem({ done, label, href, icon, onClick }: ChecklistItemProps): React.JSX.Element {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} onClick={onClick}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 6, border: `1px solid rgba(92, 61, 30, 0.12)`,
          backgroundColor: done ? 'rgba(86, 117, 89, 0.06)' : COLORS.cream,
          cursor: 'pointer', transition: 'background-color 0.15s',
        }}
      >
        <div style={{ color: done ? COLORS.sage : COLORS.copper, fontSize: 18 }}>
          {done ? <CheckCircleOutlined /> : icon}
        </div>
        <Text style={{ color: done ? COLORS.sage : COLORS.walnut, textDecoration: done ? 'line-through' : 'none' }}>
          {label}
        </Text>
      </div>
    </Link>
  )
}
