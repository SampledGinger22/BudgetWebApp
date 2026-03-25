'use client'

import { CheckCircleFilled, InfoCircleOutlined } from '@ant-design/icons'
import { Tooltip, Typography } from 'antd'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS, MONEY_FONT } from '@/theme'

const { Text } = Typography

interface ReconciliationHeaderProps {
  statementBalanceCents: number
  clearedBalanceCents: number
  clearedDepositsCents: number
  clearedPaymentsCents: number
}

/**
 * Sticky header bar showing reconciliation progress:
 * statement balance, cleared balance, difference, checked deposits/payments.
 */
export function ReconciliationHeader({
  statementBalanceCents,
  clearedBalanceCents,
  clearedDepositsCents,
  clearedPaymentsCents,
}: ReconciliationHeaderProps): React.JSX.Element {
  const differenceCents = statementBalanceCents - clearedBalanceCents
  const isMatched = differenceCents === 0

  let statusMessage: React.ReactNode
  if (isMatched) {
    statusMessage = (
      <Text strong style={{ fontSize: 15, color: COLORS.sage }}>
        <CheckCircleFilled style={{ marginRight: 6 }} />
        Everything matches your bank statement.
      </Text>
    )
  } else if (differenceCents > 0) {
    statusMessage = (
      <Text style={{ fontSize: 13, color: COLORS.terracotta }}>
        Your cleared balance is {formatCurrency(Math.abs(differenceCents))} less than your statement &mdash; keep checking transactions.
      </Text>
    )
  } else {
    statusMessage = (
      <Text style={{ fontSize: 13, color: COLORS.terracotta }}>
        Your cleared balance is {formatCurrency(Math.abs(differenceCents))} more than your statement &mdash; review checked transactions.
      </Text>
    )
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        padding: '12px 20px',
        background: COLORS.creamDark,
        border: `1px solid rgba(92, 61, 30, 0.15)`,
        borderRadius: 6,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Statement Balance */}
      <div>
        <Text style={{ fontSize: 11, color: COLORS.walnut, display: 'block', marginBottom: 2 }}>
          Statement Balance{' '}
          <Tooltip title="The ending balance shown on your bank statement for this period.">
            <InfoCircleOutlined style={{ color: COLORS.walnut, marginLeft: 4, cursor: 'help' }} />
          </Tooltip>
        </Text>
        <Text strong style={{ fontSize: 18, fontFamily: MONEY_FONT, color: COLORS.walnut }}>
          {formatCurrency(statementBalanceCents)}
        </Text>
      </div>

      {/* Cleared Balance */}
      <div>
        <Text style={{ fontSize: 11, color: COLORS.walnut, display: 'block', marginBottom: 2 }}>
          Cleared Balance{' '}
          <Tooltip title="Your account's opening balance plus all transactions you've marked as cleared. This should match your statement balance when you're done.">
            <InfoCircleOutlined style={{ color: COLORS.walnut, marginLeft: 4, cursor: 'help' }} />
          </Tooltip>
        </Text>
        <Text strong style={{ fontSize: 18, fontFamily: MONEY_FONT, color: COLORS.walnut }}>
          {formatCurrency(clearedBalanceCents)}
        </Text>
      </div>

      {/* Difference */}
      <div>
        <Text style={{ fontSize: 11, color: COLORS.walnut, display: 'block', marginBottom: 2 }}>
          Difference{' '}
          <Tooltip title="The gap between your statement balance and cleared balance. Check off more transactions to close this gap.">
            <InfoCircleOutlined style={{ color: COLORS.walnut, marginLeft: 4, cursor: 'help' }} />
          </Tooltip>
        </Text>
        <Text strong style={{ fontSize: 18, fontFamily: MONEY_FONT, color: isMatched ? COLORS.sage : COLORS.terracotta }}>
          {formatCurrency(Math.abs(differenceCents))}
        </Text>
      </div>

      {/* Divider */}
      <div style={{ borderLeft: `1px solid rgba(92, 61, 30, 0.15)`, height: 36, flexShrink: 0 }} />

      {/* Checked Deposits */}
      <div>
        <Text style={{ fontSize: 11, color: COLORS.walnut, display: 'block', marginBottom: 2 }}>
          Checked Deposits
        </Text>
        <Text style={{ fontSize: 15, fontFamily: MONEY_FONT, color: COLORS.sage }}>
          +{formatCurrency(clearedDepositsCents)}
        </Text>
      </div>

      {/* Checked Payments */}
      <div>
        <Text style={{ fontSize: 11, color: COLORS.walnut, display: 'block', marginBottom: 2 }}>
          Checked Payments
        </Text>
        <Text style={{ fontSize: 15, fontFamily: MONEY_FONT, color: COLORS.terracotta }}>
          -{formatCurrency(clearedPaymentsCents)}
        </Text>
      </div>

      {/* Status message */}
      <div style={{ marginLeft: 'auto' }}>
        {statusMessage}
      </div>
    </div>
  )
}
