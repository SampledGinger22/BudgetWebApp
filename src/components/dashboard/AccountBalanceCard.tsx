'use client'

import { Typography } from 'antd'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

export interface AccountBalanceCardProps {
  name: string
  type: string
  balance_cents: number
  onClick?: () => void
}

export function AccountBalanceCard({ name, type, balance_cents, onClick }: AccountBalanceCardProps): React.JSX.Element {
  const isNeg = balance_cents < 0
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: '1px solid rgba(92, 61, 30, 0.08)',
        cursor: onClick ? 'pointer' : undefined,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div>
        <Text strong style={{ color: COLORS.walnut }}>{name}</Text>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{type}</Text>
      </div>
      <Text style={{ fontFamily: MONEY_FONT, fontWeight: 600, color: isNeg ? COLORS.terracotta : COLORS.sage }}>
        {formatCurrency(balance_cents)}
      </Text>
    </div>
  )
}
