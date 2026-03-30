'use client'

import { CheckCircleFilled } from '@ant-design/icons'
import { Alert, Checkbox, Modal, Select, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { Account } from '@/lib/api/types'
import { useLastReconciledDates } from '@/lib/api/reconciliation'
import { useBudgetPeriodsStatus, useClosePeriod } from '@/lib/api/budget'
import { useUpdateSetting } from '@/lib/api/settings'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS, MONEY_FONT } from '@/theme'

const { Text } = Typography

interface ReconciliationSummaryProps {
  open: boolean
  statementDate: string
  statementBalanceCents: number
  reconciledCount: number
  accountName: string
  accounts: Account[]
  currentAccountId: number
  onDone: () => void
  onReconcileAnother: (accountId: number) => void
}

/**
 * Post-reconciliation summary modal with:
 * - Success confirmation + stats
 * - Lock account option
 * - Period close prompt when all accounts reconciled
 * - Reconcile another account selector
 */
export function ReconciliationSummary({
  open,
  statementDate,
  statementBalanceCents,
  reconciledCount,
  accountName,
  accounts,
  currentAccountId,
  onDone,
  onReconcileAnother,
}: ReconciliationSummaryProps): React.JSX.Element {
  const [lockAccount, setLockAccount] = useState(false)
  const [allReconciled, setAllReconciled] = useState(false)
  const [activeAccountCount, setActiveAccountCount] = useState(0)
  const [reconciledAccountCount, setReconciledAccountCount] = useState(0)
  const [closeablePeriodId, setCloseablePeriodId] = useState<number | null>(null)

  const { data: lastReconciledDates = [] } = useLastReconciledDates()
  const { data: periodsStatusResp } = useBudgetPeriodsStatus()
  const periodsStatus = periodsStatusResp?.data ?? []
  const closePeriod = useClosePeriod()
  const updateSetting = useUpdateSetting()

  useEffect(() => {
    if (!open) return

    const activeAccounts = accounts.filter((a) => a.archived_at == null)
    setActiveAccountCount(activeAccounts.length)

    // Build last-reconciled lookup from array
    const reconDatesMap = new Map(lastReconciledDates.map((d) => [d.account_id, d.last_statement_date]))
    const reconCount = activeAccounts.filter((a) => reconDatesMap.has(a.id)).length
    setReconciledAccountCount(reconCount)
    setAllReconciled(reconCount === activeAccounts.length && activeAccounts.length > 0)

    // Find closeable period
    const today = dayjs().format('YYYY-MM-DD')
    // Look for a period that could be closed (open, not locked)
    const currentOpen = periodsStatus.find(
      (p) => p.start_date <= today && p.end_date >= today && p.closed_at == null,
    )
    setCloseablePeriodId(currentOpen?.id ?? null)
  }, [open, accounts, lastReconciledDates, periodsStatus])

  const handleDone = (): void => {
    if (lockAccount) {
      void updateSetting.mutateAsync({ key: `account_lock_${currentAccountId}`, value: statementDate })
    }
    onDone()
  }

  const handleClosePeriod = async (): Promise<void> => {
    if (!closeablePeriodId) return
    try {
      await closePeriod.mutateAsync({ subPeriodId: closeablePeriodId })
      void message.success('Budget period finalized successfully')
    } catch {
      void message.error('Failed to finalize budget period')
    }
  }

  const otherAccounts = accounts.filter((a) => a.id !== currentAccountId && a.archived_at == null)

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onDone}
      footer={null}
      width={480}
    >
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <CheckCircleFilled style={{ fontSize: 48, color: COLORS.sage, marginBottom: 12 }} />
        <Text strong style={{ fontSize: 20, color: COLORS.walnut, display: 'block', marginBottom: 4 }}>
          Reconciliation Complete
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {accountName}
        </Text>
      </div>

      {/* Summary details */}
      <div
        style={{
          background: 'rgba(86, 117, 89, 0.06)',
          borderRadius: 6,
          padding: '16px 20px',
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: COLORS.walnut }}>Statement Date</Text>
          <Text style={{ fontSize: 13, fontFamily: MONEY_FONT }}>
            {dayjs(statementDate).format('MMM D, YYYY')}
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: COLORS.walnut }}>Statement Balance</Text>
          <Text style={{ fontSize: 13, fontFamily: MONEY_FONT }}>
            {formatCurrency(statementBalanceCents)}
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: COLORS.walnut }}>Transactions Reconciled</Text>
          <Text style={{ fontSize: 13 }}>
            {reconciledCount}
          </Text>
        </div>
      </div>

      {/* Account lock prompt */}
      <div style={{ marginBottom: 16 }}>
        <Checkbox onChange={(e) => setLockAccount(e.target.checked)}>
          Lock this account through {dayjs(statementDate).format('MMM D, YYYY')}
        </Checkbox>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginLeft: 24, marginTop: 2 }}>
          Adds a visual indicator &mdash; transactions before this date will show as locked.
        </Text>
      </div>

      {/* Period close prompt — UX-05: "Finalize" language */}
      {allReconciled && closeablePeriodId != null && (
        <Alert
          type="success"
          showIcon
          title={
            <div>
              <Text style={{ fontSize: 13 }}>
                All accounts have been reconciled. Would you like to finalize this budget period?
              </Text>
              <div style={{ marginTop: 8 }}>
                <a
                  onClick={handleClosePeriod}
                  style={{ color: COLORS.sage, cursor: 'pointer', fontWeight: 600 }}
                >
                  Finalize Period
                </a>
              </div>
            </div>
          }
          style={{ marginBottom: 16, borderRadius: 6 }}
        />
      )}

      {!allReconciled && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
          {reconciledAccountCount} of {activeAccountCount} accounts reconciled for this period.
        </Text>
      )}

      {/* Reconcile another account */}
      {otherAccounts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder="Reconcile another account..."
            options={otherAccounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(accountId) => onReconcileAnother(accountId)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Done button */}
      <div style={{ textAlign: 'right' }}>
        <button
          onClick={handleDone}
          style={{
            background: COLORS.sage,
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
