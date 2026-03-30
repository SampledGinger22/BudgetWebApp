'use client'

import { DatePicker, InputNumber, Modal, Space, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useReconBalance } from '@/lib/api/reconciliation'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

interface ReconciliationSetupProps {
  open: boolean
  accountId: number | null
  onStart: (statementDate: string, statementBalanceCents: number) => void
  onCancel: () => void
}

/**
 * Setup dialog for starting a reconciliation session.
 * TXNS-05: Collects both opening balance (pre-filled from last reconciled) and ending balance.
 */
export function ReconciliationSetup({
  open,
  accountId,
  onStart,
  onCancel,
}: ReconciliationSetupProps): React.JSX.Element {
  const [statementDate, setStatementDate] = useState<dayjs.Dayjs | null>(dayjs())
  const [endingBalanceDollars, setEndingBalanceDollars] = useState<number | null>(null)
  const [openingBalanceDollars, setOpeningBalanceDollars] = useState<number | null>(null)

  // TXNS-05: Pre-fill opening balance from last reconciled balance
  const { data: reconBalance } = useReconBalance(accountId ?? 0)

  // Default opening balance from the previously reconciled balance
  const defaultOpeningCents = reconBalance?.reconciled_balance_cents ?? 0
  const effectiveOpeningDollars = openingBalanceDollars ?? defaultOpeningCents / 100

  const canStart = statementDate !== null && endingBalanceDollars !== null

  const handleOk = (): void => {
    if (!canStart) return
    const dateFmt = statementDate!.format('YYYY-MM-DD')
    const cents = Math.round(endingBalanceDollars! * 100)
    onStart(dateFmt, cents)

    // Reset for next use
    setStatementDate(dayjs())
    setEndingBalanceDollars(null)
    setOpeningBalanceDollars(null)
  }

  const handleCancel = (): void => {
    setStatementDate(dayjs())
    setEndingBalanceDollars(null)
    setOpeningBalanceDollars(null)
    onCancel()
  }

  return (
    <Modal
      title={
        <Text strong style={{ color: COLORS.walnut, fontSize: 16 }}>
          Start Reconciliation
        </Text>
      }
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Start Reconciliation"
      okButtonProps={{ disabled: !canStart }}
      width={400}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%', marginTop: 12 }}>
        <div>
          <Text strong style={{ fontSize: 14, color: COLORS.walnut, marginBottom: 2, display: 'block' }}>
            Step 1: Enter your bank statement info
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Find the balances and date on your bank or credit card statement.
          </Text>
        </div>

        {/* Statement Date */}
        <div>
          <Text style={{ fontSize: 13, color: COLORS.walnut, display: 'block', marginBottom: 4 }}>
            Statement Date
          </Text>
          <DatePicker
            value={statementDate}
            format="MMM D, YYYY"
            onChange={(val) => setStatementDate(val)}
            style={{ width: '100%' }}
          />
        </div>

        {/* TXNS-05: Opening Balance */}
        <div>
          <Text style={{ fontSize: 13, color: COLORS.walnut, display: 'block', marginBottom: 4 }}>
            Opening Balance
          </Text>
          <InputNumber
            value={effectiveOpeningDollars}
            onChange={(val) => setOpeningBalanceDollars(val)}
            precision={2}
            prefix="$"
            style={{ width: '100%' }}
            placeholder="0.00"
          />
          {reconBalance && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              Pre-filled from last reconciled balance: {formatCurrency(reconBalance.reconciled_balance_cents)}
            </Text>
          )}
        </div>

        {/* TXNS-05: Ending Balance */}
        <div>
          <Text style={{ fontSize: 13, color: COLORS.walnut, display: 'block', marginBottom: 4 }}>
            Statement Ending Balance
          </Text>
          <InputNumber
            value={endingBalanceDollars}
            onChange={(val) => setEndingBalanceDollars(val)}
            precision={2}
            prefix="$"
            style={{ width: '100%' }}
            placeholder="0.00"
          />
        </div>

        {/* What happens next */}
        <div style={{ background: 'rgba(86, 117, 89, 0.06)', padding: '10px 12px', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <strong>What happens next:</strong> You&rsquo;ll see your transactions and check off each one
            that appears on your statement. When the totals match, you&rsquo;re done!
          </Text>
        </div>
      </Space>
    </Modal>
  )
}
