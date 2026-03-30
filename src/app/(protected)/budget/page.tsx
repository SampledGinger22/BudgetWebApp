'use client'

import { useState, useMemo } from 'react'
import { Modal, Skeleton, Space, Spin, Typography, Button, message } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import {
  useBudgetVariance,
  useBudgetSummary,
  useBudgetPeriodsStatus,
  useBudgetTransfers,
  useAllocateBudget,
  useClosePeriod,
  useReopenPeriod,
  useLockPeriod,
  useUnlockPeriod,
} from '@/lib/api/budget'
import { useCategories } from '@/lib/api/categories'
import { usePeriods } from '@/lib/api/periods'
import { BudgetSummaryCards } from '@/components/budget/BudgetSummaryCards'
import { QuickAssignWidget } from '@/components/budget/QuickAssignWidget'
import { VarianceTable } from '@/components/budget/VarianceTable'
import { TransferModal } from '@/components/budget/TransferModal'
import { TransferHistory } from '@/components/budget/TransferHistory'
import { PeriodStatusBadge } from '@/components/budget/PeriodStatusBadge'
import { CloseConfirmModal } from '@/components/budget/CloseConfirmModal'
import { BudgetCopyActions } from '@/components/budget/BudgetCopyActions'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PeriodSelector } from '@/components/common/PeriodSelector'
import { useReverseTransfer } from '@/lib/api/budget'
import { COLORS } from '@/theme'
import type { BudgetSubPeriod } from '@/lib/api/types'

const { Title } = Typography

// ─── Period label helpers ─────────────────────────────────────────────────────

function formatPeriodDateRange(sp: BudgetSubPeriod): string {
  const fmt = (d: string): string => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(sp.start_date)} – ${fmt(sp.end_date)}`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetPage(): React.JSX.Element {
  // Periods data for selector
  const { data: periodsResp, isLoading: periodsLoading } = usePeriods()
  const periods = periodsResp?.data ?? []

  // Categories for transfer modal, quick assign, copy actions
  const { data: groups } = useCategories()
  const categoryGroups = groups ?? []

  // Collect all sub-periods across all budget periods for the selector
  const allSubPeriods = useMemo(
    () => periods.flatMap((p) => p.sub_periods ?? []),
    [periods],
  )

  const [selectedSubPeriodId, setSelectedSubPeriodId] = useState<number | null>(null)

  // Modal state for period close confirmation
  const [closeModalOpen, setCloseModalOpen] = useState(false)

  // S06 budget query hooks — enabled when subPeriodId is truthy
  const subPeriodId = selectedSubPeriodId ?? 0
  const { data: varianceResp, isLoading: varianceLoading } = useBudgetVariance(subPeriodId)
  const { data: summary } = useBudgetSummary(subPeriodId)
  const { data: periodsStatusResp } = useBudgetPeriodsStatus()
  const { data: transfersResp } = useBudgetTransfers(subPeriodId)

  const varianceRows = varianceResp?.data ?? []
  const transfers = transfersResp?.data ?? []
  const periodsWithStatus = periodsStatusResp?.data ?? []

  // Period lifecycle mutations
  const closePeriod = useClosePeriod()
  const reopenPeriod = useReopenPeriod()
  const lockPeriod = useLockPeriod()
  const unlockPeriod = useUnlockPeriod()
  const reverseTransfer = useReverseTransfer()
  const allocateBudget = useAllocateBudget()

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [prefillFromCategoryId, setPrefillFromCategoryId] = useState<number | null>(null)

  // The selected sub-period object (for date display and carry-forward)
  const selectedSubPeriod = allSubPeriods.find((sp) => sp.id === selectedSubPeriodId) ?? null

  const hasPeriods = allSubPeriods.length > 0

  // Period lifecycle: compute what actions are available from periodsWithStatus
  const periodStatus = useMemo(() => {
    const found = periodsWithStatus.find((p) => p.id === selectedSubPeriodId)
    return {
      closedAt: found?.closed_at ?? null,
      lockedAt: found?.locked_at ?? null,
    }
  }, [periodsWithStatus, selectedSubPeriodId])

  const isOpen = !periodStatus.closedAt && !periodStatus.lockedAt
  const isClosed = !!periodStatus.closedAt && !periodStatus.lockedAt
  const isLocked = !!periodStatus.lockedAt

  // "Finalize Period" button visible when open and end_date has passed (UX-05)
  const today = new Date().toISOString().slice(0, 10)
  const endDatePassed = selectedSubPeriod
    ? selectedSubPeriod.end_date < today
    : false
  const canClose = isOpen && endDatePassed

  // Surplus for modal: income - spent
  const surplusCents = (summary?.total_income_cents ?? 0) - (summary?.total_spent_cents ?? 0)

  // ─── Period lifecycle handlers (UX-05 approachable language) ────────────────

  async function handleConfirmClose(): Promise<void> {
    setCloseModalOpen(false)
    try {
      await closePeriod.mutateAsync({ subPeriodId })
      void message.success('Period finalized successfully')
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Failed to finalize period')
    }
  }

  async function handleLock(): Promise<void> {
    try {
      await lockPeriod.mutateAsync({ subPeriodId })
      void message.success('Period frozen successfully')
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Failed to freeze period')
    }
  }

  function handleUnlock(): void {
    // UX-05: "Unlock" → "Unfreeze"
    Modal.confirm({
      title: 'Unfreeze Period',
      content:
        'Unfreezing this period will allow transaction edits. If subsequent periods are finalized, their rolled-over amounts will be recalculated.',
      okText: 'Unfreeze',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await unlockPeriod.mutateAsync({ subPeriodId })
          void message.success('Period unfrozen successfully')
        } catch (err) {
          void message.error(err instanceof Error ? err.message : 'Failed to unfreeze period')
        }
      },
    })
  }

  function handleReopen(): void {
    Modal.confirm({
      title: 'Reopen Period',
      content:
        'Reopening this period will recalculate rolled-over amounts for all subsequent finalized periods. Are you sure?',
      okText: 'Reopen',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: async () => {
        try {
          await reopenPeriod.mutateAsync({ subPeriodId })
          void message.success('Period reopened successfully')
        } catch (err) {
          void message.error(err instanceof Error ? err.message : 'Failed to reopen period')
        }
      },
    })
  }

  if (periodsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0, color: COLORS.walnut }}>
          Budget
        </Title>
      </div>

      {/* Period selector + status badge + lifecycle controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <PeriodSelector
          value={selectedSubPeriodId}
          onChange={setSelectedSubPeriodId}
          periods={periods}
          loading={periodsLoading}
        />

        {/* Period status badge */}
        {selectedSubPeriodId != null && (
          <PeriodStatusBadge
            closedAt={periodStatus.closedAt}
            lockedAt={periodStatus.lockedAt}
          />
        )}

        {/* Period lifecycle action buttons — UX-05 labels */}
        {selectedSubPeriodId != null && (
          <Space size={8}>
            {canClose && (
              <Button
                type="primary"
                size="small"
                onClick={() => setCloseModalOpen(true)}
                loading={closePeriod.isPending}
              >
                Finalize Period
              </Button>
            )}
            {isClosed && (
              <Button
                size="small"
                onClick={handleLock}
                loading={lockPeriod.isPending}
              >
                Freeze Period
              </Button>
            )}
            {isLocked && (
              <Button
                size="small"
                onClick={handleUnlock}
                loading={unlockPeriod.isPending}
              >
                Unfreeze Period
              </Button>
            )}
            {(isClosed || isLocked) && (
              <Button
                size="small"
                danger
                onClick={handleReopen}
                loading={reopenPeriod.isPending}
              >
                Reopen Period
              </Button>
            )}
          </Space>
        )}
      </div>

      {/* Summary cards */}
      {hasPeriods && (
        <ErrorBoundary label="Summary Cards">
          <BudgetSummaryCards summary={summary ?? null} loading={varianceLoading} />
        </ErrorBoundary>
      )}

      {/* Quick-assign widget + Transfer button + Copy actions */}
      {hasPeriods && selectedSubPeriodId != null && (
        <Space wrap>
          <QuickAssignWidget
            groups={categoryGroups}
            summary={summary ?? null}
            onAssign={async (categoryId, allocatedCents) => {
              await allocateBudget.mutateAsync({
                budget_sub_period_id: subPeriodId,
                category_id: categoryId,
                allocated_cents: allocatedCents,
              })
            }}
            disabled={varianceLoading}
          />
          {isOpen && (
            <Button
              icon={<SwapOutlined />}
              onClick={() => {
                setPrefillFromCategoryId(null)
                setTransferModalOpen(true)
              }}
            >
              Transfer
            </Button>
          )}
          {isOpen && (
            <BudgetCopyActions
              currentSubPeriodId={selectedSubPeriodId}
              allSubPeriods={allSubPeriods}
              periodsWithStatus={periodsWithStatus}
              onCopyComplete={() => {
                // TanStack Query auto-invalidates on mutation success
              }}
              disabled={varianceLoading}
            />
          )}
        </Space>
      )}

      {/* Variance table — skeleton shown while switching periods */}
      {hasPeriods && selectedSubPeriodId != null ? (
        varianceLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ErrorBoundary label="Variance Table">
            <VarianceTable
              rows={varianceRows}
              loading={varianceLoading}
              selectedSubPeriodId={selectedSubPeriodId}
              subPeriodId={subPeriodId}
              transfers={transfers}
              onTransferFromCategory={
                isOpen
                  ? (categoryId) => {
                      setPrefillFromCategoryId(categoryId)
                      setTransferModalOpen(true)
                    }
                  : undefined
              }
            />
          </ErrorBoundary>
        )
      ) : null}

      {/* Transfer history — hidden when no transfers exist, collapsed by default */}
      {hasPeriods && selectedSubPeriodId != null && transfers.length > 0 && (
        <ErrorBoundary label="Transfer History">
          <TransferHistory
            transfers={transfers}
            onReverse={async (id) => {
              try {
                await reverseTransfer.mutateAsync({ id })
                void message.success('Transfer reversed')
              } catch (err) {
                void message.error(err instanceof Error ? err.message : 'Failed to reverse transfer')
              }
            }}
            isOpen={isOpen}
          />
        </ErrorBoundary>
      )}

      {/* No data state */}
      {hasPeriods && selectedSubPeriodId != null && !varianceLoading && varianceRows.length === 0 && (
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 32 }}>
          No budget categories found. Add categories in Settings to start allocating.
        </Typography.Text>
      )}

      {/* Transfer modal */}
      {selectedSubPeriodId != null && (
        <TransferModal
          open={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false)
            setPrefillFromCategoryId(null)
          }}
          onTransferComplete={() => {
            setTransferModalOpen(false)
            setPrefillFromCategoryId(null)
            // TanStack Query auto-invalidates on mutation success
          }}
          subPeriodId={subPeriodId}
          varianceRows={varianceRows}
          groups={categoryGroups}
          prefillFromCategoryId={prefillFromCategoryId}
        />
      )}

      {/* Finalize Period confirmation modal (UX-05) */}
      {selectedSubPeriod != null && (
        <CloseConfirmModal
          open={closeModalOpen}
          subPeriodId={selectedSubPeriod.id}
          periodLabel={formatPeriodDateRange(selectedSubPeriod)}
          totalIncomeCents={summary?.total_income_cents ?? 0}
          totalSpentCents={summary?.total_spent_cents ?? 0}
          surplusCents={surplusCents}
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseModalOpen(false)}
        />
      )}
    </Space>
  )
}
