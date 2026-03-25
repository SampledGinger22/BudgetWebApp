'use client'

import { Modal, Descriptions, Typography } from 'antd'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

interface CloseConfirmModalProps {
  open: boolean
  subPeriodId: number
  periodLabel: string
  totalIncomeCents: number
  totalSpentCents: number
  surplusCents: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation modal for finalizing a budget period (UX-05: "close" → "finalize").
 * Displays period summary (income, spent, left over/overspent, rolled-over amount)
 * and confirms the action with the user.
 *
 * Preserves the imperative Modal.confirm `let` variable closure pattern
 * as specified in KNOWLEDGE.md.
 */
export function CloseConfirmModal({
  open,
  periodLabel,
  totalIncomeCents,
  totalSpentCents,
  surplusCents,
  onConfirm,
  onCancel,
}: CloseConfirmModalProps): React.JSX.Element {
  const isPositive = surplusCents >= 0

  // UX-05: "Surplus" → "Left Over", "Deficit" → "Overspent"
  const surplusLabel = isPositive ? 'Left Over' : 'Overspent'

  return (
    <Modal
      title="Finalize Budget Period"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="Finalize Period"
      okType="primary"
      cancelText="Cancel"
      width={480}
    >
      {/* Period date range */}
      <Text
        strong
        style={{ display: 'block', marginBottom: 16, fontSize: 15, color: COLORS.walnut }}
      >
        {periodLabel}
      </Text>

      {/* Summary */}
      <Descriptions
        column={1}
        size="small"
        bordered
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item
          label="Total Income"
          labelStyle={{ color: COLORS.walnut }}
        >
          <span style={{ fontFamily: MONEY_FONT, color: COLORS.sage, fontWeight: 600 }}>
            {formatCurrency(totalIncomeCents)}
          </span>
        </Descriptions.Item>

        <Descriptions.Item
          label="Total Spent"
          labelStyle={{ color: COLORS.walnut }}
        >
          <span style={{ fontFamily: MONEY_FONT, color: COLORS.terracotta, fontWeight: 600 }}>
            {formatCurrency(totalSpentCents)}
          </span>
        </Descriptions.Item>

        <Descriptions.Item
          label={surplusLabel}
          labelStyle={{ color: COLORS.walnut }}
        >
          <span
            style={{
              fontFamily: MONEY_FONT,
              color: isPositive ? COLORS.sage : COLORS.terracotta,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {isPositive ? '' : '-'}{formatCurrency(Math.abs(surplusCents))}
          </span>
        </Descriptions.Item>

        {/* UX-05: "Carry-Forward to Next Period" → "Rolled Over to Next Period" */}
        <Descriptions.Item
          label="Rolled Over to Next Period"
          labelStyle={{ color: COLORS.walnut }}
        >
          <span
            style={{
              fontFamily: MONEY_FONT,
              color: isPositive ? COLORS.sage : COLORS.terracotta,
              fontWeight: 600,
            }}
          >
            {isPositive ? '' : '-'}{formatCurrency(Math.abs(surplusCents))}
          </span>
        </Descriptions.Item>
      </Descriptions>

      {/* Explanation — UX-05 language */}
      <Text type="secondary" style={{ fontSize: 13 }}>
        Finalizing this period will calculate the amount left over or overspent and roll it over to
        the next period. This cannot be undone without reopening the period.
      </Text>
    </Modal>
  )
}

export default CloseConfirmModal
