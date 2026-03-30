'use client'

import { Alert, Button, Dropdown, Select, Space, Tour, Typography, message } from 'antd'
import type { MenuProps, TourProps } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { TransactionRow, ReconciliationSession, Account } from '@/lib/api/types'
import { useAccounts } from '@/lib/api/accounts'
import { usePeriods, useSchedules } from '@/lib/api/periods'
import {
  useTransactions,
  useTransactionSummary,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '@/lib/api/transactions'
import {
  useReconBalance,
  useUnreconciledTransactions,
  useLastReconciledDates,
  useStartReconSession,
  useUpdateCleared,
  useFinishReconSession,
  useCancelReconSession,
} from '@/lib/api/reconciliation'
import { useConfirmEntry, useBulkConfirm } from '@/lib/api/recurring'
import { useBudgetPeriodsStatus } from '@/lib/api/budget'
import { useSetting, useUpdateSetting } from '@/lib/api/settings'
import { LedgerFilterBar, type TransactionFilters } from '@/components/transactions/LedgerFilterBar'
import { PendingRecurringBanner } from '@/components/transactions/PendingRecurringBanner'
import { LedgerSummaryCards } from '@/components/transactions/LedgerSummaryCards'
import { TransactionDrawer } from '@/components/transactions/TransactionDrawer'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { InlineAddRow } from '@/components/transactions/InlineAddRow'
import { ReconciliationSetup } from '@/components/reconciliation/ReconciliationSetup'
import { ReconciliationHeader } from '@/components/reconciliation/ReconciliationHeader'
import { ReconciliationTable } from '@/components/reconciliation/ReconciliationTable'
import { ReconciliationFooter } from '@/components/reconciliation/ReconciliationFooter'
import { ReconciliationHistory } from '@/components/reconciliation/ReconciliationHistory'
import { ReconciliationSummary } from '@/components/reconciliation/ReconciliationSummary'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PeriodSelector, type PeriodSelectorMode } from '@/components/common/PeriodSelector'
import { isLiabilityAccount } from '@/lib/utils/accountUtils'
import { COLORS } from '@/theme'

const { Text, Title } = Typography

// ─── Reconciliation phase state machine ────────────────────────────────────────

type ReconPhase = 'idle' | 'setup' | 'reconciling' | 'summary'

/**
 * TransactionsPage — the most complex page in the app.
 *
 * Manages: account selection, period filtering, transaction CRUD,
 * inline add, edit drawer, recurring confirmation, and the full
 * reconciliation state machine (setup → reconciling → summary).
 *
 * Consumes data from 6+ API domains: transactions, reconciliation,
 * recurring, budget, settings, accounts.
 */
export default function TransactionsPage(): React.JSX.Element {
  const searchParams = useSearchParams()
  const importBatchIdParam = searchParams.get('importBatchId')

  // ─── Account & period state ──────────────────────────────────────────────

  const { data: accounts = [] } = useAccounts()
  const { data: periodsResp } = usePeriods()
  const { data: schedulesResp } = useSchedules()
  const periods = periodsResp?.data ?? []
  const schedules = schedulesResp?.data ?? []

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedSubPeriodId, setSelectedSubPeriodId] = useState<number | null>(null)

  // Period mode state
  const [periodMode, setPeriodMode] = useState<PeriodSelectorMode>('custom')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  // ─── Filters & pagination ────────────────────────────────────────────────

  const [filters, setFilters] = useState<TransactionFilters>(() =>
    importBatchIdParam ? { import_batch_id: Number(importBatchIdParam) } : {},
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ─── Build query params ──────────────────────────────────────────────────

  const queryParams = useMemo(() => ({
    accountId: selectedAccountId ?? 0,
    subPeriodId: selectedSubPeriodId ?? undefined,
    page,
    pageSize,
    ...filters,
  }), [selectedAccountId, selectedSubPeriodId, page, pageSize, filters])

  // ─── Data hooks (all driven by selectedAccountId) ────────────────────────

  const { data: txnResp, isLoading: txnLoading } = useTransactions(queryParams)
  const transactions = txnResp?.data ?? []
  const totalCount = txnResp?.totalCount ?? 0

  const { data: summary, isLoading: summaryLoading } = useTransactionSummary({
    accountId: selectedAccountId ?? 0,
    subPeriodId: selectedSubPeriodId ?? undefined,
    ...filters,
  })

  const { data: periodsStatusResp } = useBudgetPeriodsStatus()
  const periodsWithStatus = periodsStatusResp?.data ?? []

  const { data: lastReconciledDates = [] } = useLastReconciledDates()
  const { data: reconBalanceResp } = useReconBalance(selectedAccountId ?? 0)

  const updateSetting = useUpdateSetting()
  const confirmEntry = useConfirmEntry()
  const bulkConfirm = useBulkConfirm()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()

  // ─── Drawer state ────────────────────────────────────────────────────────

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState<TransactionRow | null>(null)

  // ─── Reconciliation state machine ────────────────────────────────────────

  const [reconPhase, setReconPhase] = useState<ReconPhase>('idle')
  const [reconSession, setReconSession] = useState<ReconciliationSession | null>(null)
  const [reconTransactions, setReconTransactions] = useState<TransactionRow[]>([])
  const [clearedIds, setClearedIds] = useState<Set<number>>(new Set())
  const [reconLoading, setReconLoading] = useState(false)
  const [finishLoading, setFinishLoading] = useState(false)
  const [previousReconciledBalanceCents, setPreviousReconciledBalanceCents] = useState(0)
  const [hasUnfinishedSession, setHasUnfinishedSession] = useState(false)
  const [unfinishedSession, setUnfinishedSession] = useState<ReconciliationSession | null>(null)

  // History + summary
  const [historyOpen, setHistoryOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [lastReconciledResult, setLastReconciledResult] = useState<{
    reconciledCount: number
    statementDate: string
    statementBalanceCents: number
  } | null>(null)

  // Tour
  const headerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const finishBtnRef = useRef<HTMLDivElement>(null)
  const [tourOpen, setTourOpen] = useState(false)

  // Keyboard focus for reconciliation
  const [focusedTxId, setFocusedTxId] = useState<number | null>(null)

  // Reconciliation mutation hooks
  const startReconSession = useStartReconSession()
  const updateClearedMutation = useUpdateCleared()
  const finishReconSession = useFinishReconSession()
  const cancelReconSession = useCancelReconSession()

  // Unreconciled transactions hook (only during active recon)
  const statementDate = reconSession?.statement_date ?? ''
  const { data: unreconTxns } = useUnreconciledTransactions(
    selectedAccountId ?? 0,
    statementDate,
  )

  // ─── Derived ─────────────────────────────────────────────────────────────

  const activeAccounts = accounts.filter((a) => a.archived_at == null)
  const accountOptions = activeAccounts.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.type})`,
  }))

  const selectedPeriodStatus = periodsWithStatus.find(
    (sp) => sp.id === selectedSubPeriodId,
  )
  const isLocked = selectedPeriodStatus?.locked_at != null

  // Last reconciled date for selected account
  const lastReconciledDate = useMemo(() => {
    if (!selectedAccountId) return null
    const entry = lastReconciledDates.find((d) => d.account_id === selectedAccountId)
    return entry?.last_statement_date ?? null
  }, [selectedAccountId, lastReconciledDates])

  const selectedAccountType = accounts.find((a) => a.id === selectedAccountId)?.type ?? 'checking'
  const isLiability = isLiabilityAccount(selectedAccountType)

  // ─── Default to first checking account on mount ─────────────────────────

  useEffect(() => {
    if (selectedAccountId == null && accounts.length > 0) {
      const checking = accounts.find((a) => a.type === 'checking' && a.archived_at == null)
      const firstActive = accounts.find((a) => a.archived_at == null)
      const defaultAccount = checking ?? firstActive
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id)
      }
    }
  }, [accounts, selectedAccountId])

  // ─── Sync date range into filters ───────────────────────────────────────

  useEffect(() => {
    if (periodMode === 'custom' || periodMode === 'budget') {
      const today = dayjs().format('YYYY-MM-DD')
      setFilters((prev) => ({
        ...prev,
        date_from: dateRange?.[0],
        date_to: dateRange?.[1] ?? today,
      }))
    }
  }, [dateRange, periodMode])

  // ─── Period mode change handler ─────────────────────────────────────────

  const handleModeChange = (newMode: PeriodSelectorMode): void => {
    setPeriodMode(newMode)
    if (newMode === 'custom' || newMode === 'budget') {
      setSelectedSubPeriodId(null)
      if (newMode === 'budget') {
        setSelectedMonth(null)
        setDateRange(null)
        setFilters((prev) => {
          const { date_from: _df, date_to: _dt, ...rest } = prev
          return rest
        })
      }
    } else {
      setSelectedMonth(null)
      setDateRange(null)
      setFilters((prev) => {
        const { date_from: _df, date_to: _dt, ...rest } = prev
        return rest
      })
    }
  }

  // ─── Drawer ──────────────────────────────────────────────────────────────

  const openDrawer = (transaction: TransactionRow): void => {
    setSelectedTxn(transaction)
    setDrawerOpen(true)
  }

  const closeDrawer = (): void => {
    setDrawerOpen(false)
    setSelectedTxn(null)
  }

  // ─── Recurring confirm handlers ──────────────────────────────────────────

  const handleConfirm = async (txId: number, actualAmountCents: number): Promise<void> => {
    await confirmEntry.mutateAsync({ transactionId: txId, actualAmountCents })
  }

  const handleBulkConfirm = async (txIds: number[]): Promise<void> => {
    await bulkConfirm.mutateAsync({ transactionIds: txIds })
  }

  const handleUpdateDate = async (txId: number, date: string): Promise<void> => {
    await updateTransaction.mutateAsync({ id: txId, date })
  }

  // ─── Import batch filter banner ──────────────────────────────────────────

  const isFilteredByImportBatch = filters.import_batch_id != null
  const clearImportBatchFilter = (): void => {
    const { import_batch_id: _removed, ...rest } = filters
    setFilters(rest)
  }

  // ─── Reconciliation handlers ─────────────────────────────────────────────

  // Check for unfinished session when account changes
  useEffect(() => {
    if (selectedAccountId == null || reconPhase !== 'idle') return
    // Check via the recon balance response for an in-progress session
    // The history hook will show any in_progress session
    setHasUnfinishedSession(false)
    setUnfinishedSession(null)
  }, [selectedAccountId, reconPhase])

  // Show Tour on first reconciliation
  useEffect(() => {
    if (reconPhase !== 'reconciling') return
    // Check if tutorial has been seen
    // We check the setting reactively — if not seen, show tour
  }, [reconPhase])

  const { data: tutorialSetting } = useSetting('reconciliation_tutorial_seen')

  useEffect(() => {
    if (reconPhase !== 'reconciling') return
    if (!tutorialSetting?.value) {
      setTimeout(() => setTourOpen(true), 300)
    }
  }, [reconPhase, tutorialSetting])

  const handleTourClose = (): void => {
    setTourOpen(false)
    void updateSetting.mutateAsync({ key: 'reconciliation_tutorial_seen', value: '1' })
  }

  const tourSteps: TourProps['steps'] = [
    {
      title: 'Your Balance Summary',
      description: 'This bar shows your statement balance, your cleared balance, and the difference between them. Your goal is to make the difference zero.',
      target: () => headerRef.current!,
    },
    {
      title: 'Check Off Transactions',
      description: 'Find each transaction from your bank statement and check it off. Deposits and payments are shown separately, just like on your statement.',
      target: () => tableRef.current!,
    },
    {
      title: 'Finish When Balanced',
      description: 'When your cleared balance matches your statement balance (difference is $0), click "Finish Reconciliation" to save your work.',
      target: () => finishBtnRef.current!,
    },
  ]

  const handleReconcileClick = async (): Promise<void> => {
    if (!selectedAccountId) return
    setReconPhase('setup')
  }

  const enterReconcileMode = async (
    statementDate: string,
    statementBalanceCents: number,
  ): Promise<void> => {
    if (!selectedAccountId) return
    setReconLoading(true)

    try {
      const result = await startReconSession.mutateAsync({
        accountId: selectedAccountId,
        statementDate,
        statementBalanceCents,
      })
      // The session is created — we'll use the ID to track it
      const sessionId = (result as { id: number }).id
      const session: ReconciliationSession = {
        id: sessionId,
        account_id: selectedAccountId,
        statement_date: statementDate,
        statement_balance_cents: statementBalanceCents,
        status: 'in_progress',
        cleared_transaction_ids: '[]',
        completed_at: null,
        created_at: new Date().toISOString(),
        household_id: 0, // filled by server
      }
      setReconSession(session)

      // Set reconciled balance from hook data
      setPreviousReconciledBalanceCents(reconBalanceResp?.reconciled_balance_cents ?? 0)
      setClearedIds(new Set())
      setReconPhase('reconciling')
      setHasUnfinishedSession(false)
      setUnfinishedSession(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start reconciliation'
      void message.error(msg)
    } finally {
      setReconLoading(false)
    }
  }

  const handleReconcileStart = async (
    statementDate: string,
    statementBalanceCents: number,
  ): Promise<void> => {
    await enterReconcileMode(statementDate, statementBalanceCents)
  }

  // Sync unreconciled txns into local state when they load
  useEffect(() => {
    if (reconPhase === 'reconciling' && unreconTxns) {
      setReconTransactions(unreconTxns as TransactionRow[])
    }
  }, [unreconTxns, reconPhase])

  const handleToggleCleared = useCallback((txId: number): void => {
    setClearedIds((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) next.delete(txId)
      else next.add(txId)

      // Auto-save to database (fire-and-forget)
      if (reconSession) {
        void updateClearedMutation.mutateAsync({
          sessionId: reconSession.id,
          clearedIds: [...next],
        })
      }

      return next
    })
  }, [reconSession, updateClearedMutation])

  // Cleared balance computation
  const clearedBalanceCents = useMemo(() => {
    const newlyCleared = reconTransactions
      .filter((tx) => clearedIds.has(tx.id))
      .reduce((sum, tx) => {
        if (isLiability) {
          return sum + (tx.is_debit ? tx.amount_cents : -tx.amount_cents)
        }
        return sum + (tx.is_debit ? -tx.amount_cents : tx.amount_cents)
      }, 0)

    return previousReconciledBalanceCents + newlyCleared
  }, [reconTransactions, clearedIds, previousReconciledBalanceCents, isLiability])

  const clearedDepositsCents = useMemo(() => {
    return reconTransactions
      .filter((tx) => clearedIds.has(tx.id) && tx.is_debit === 0)
      .reduce((sum, tx) => sum + tx.amount_cents, 0)
  }, [reconTransactions, clearedIds])

  const clearedPaymentsCents = useMemo(() => {
    return reconTransactions
      .filter((tx) => clearedIds.has(tx.id) && tx.is_debit === 1)
      .reduce((sum, tx) => sum + tx.amount_cents, 0)
  }, [reconTransactions, clearedIds])

  const handleFinishReconciliation = async (): Promise<void> => {
    if (!reconSession) return
    setFinishLoading(true)
    try {
      await finishReconSession.mutateAsync({ id: reconSession.id })
      setLastReconciledResult({
        reconciledCount: clearedIds.size,
        statementDate: reconSession.statement_date,
        statementBalanceCents: reconSession.statement_balance_cents,
      })
      setReconPhase('summary')
      setSummaryOpen(true)
    } catch {
      void message.error('Failed to finish reconciliation')
    } finally {
      setFinishLoading(false)
    }
  }

  const handleCancelReconciliation = async (): Promise<void> => {
    if (reconSession) {
      try {
        await cancelReconSession.mutateAsync({ id: reconSession.id })
      } catch {
        // Non-critical
      }
    }
    exitReconcileMode()
  }

  const handleDiscardUnfinished = async (): Promise<void> => {
    if (unfinishedSession) {
      try {
        await cancelReconSession.mutateAsync({ id: unfinishedSession.id })
      } catch {
        // Non-critical
      }
    }
    setHasUnfinishedSession(false)
    setUnfinishedSession(null)
  }

  const exitReconcileMode = (): void => {
    setReconPhase('idle')
    setReconSession(null)
    setReconTransactions([])
    setClearedIds(new Set())
    setPreviousReconciledBalanceCents(0)
  }

  const handleSummaryDone = (): void => {
    setSummaryOpen(false)
    setLastReconciledResult(null)
    exitReconcileMode()
  }

  const handleReconcileAnother = (accountId: number): void => {
    setSummaryOpen(false)
    setLastReconciledResult(null)
    exitReconcileMode()
    setSelectedAccountId(accountId)
    setTimeout(() => setReconPhase('setup'), 100)
  }

  // Keyboard shortcuts for reconciliation (Space, ArrowUp, ArrowDown)
  useEffect(() => {
    if (reconPhase !== 'reconciling') return

    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === ' ') {
        e.preventDefault()
        if (focusedTxId != null) handleToggleCleared(focusedTxId)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (reconTransactions.length === 0) return
        const currentIdx = reconTransactions.findIndex((t) => t.id === focusedTxId)
        const nextIdx = currentIdx < reconTransactions.length - 1 ? currentIdx + 1 : 0
        setFocusedTxId(reconTransactions[nextIdx].id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (reconTransactions.length === 0) return
        const currentIdx = reconTransactions.findIndex((t) => t.id === focusedTxId)
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : reconTransactions.length - 1
        setFocusedTxId(reconTransactions[prevIdx].id)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [reconPhase, focusedTxId, reconTransactions, handleToggleCleared])

  const canFinishReconciliation = reconSession != null
    && reconSession.statement_balance_cents === clearedBalanceCents

  const isReconciling = reconPhase === 'reconciling'

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* Import batch filter banner */}
      {!isReconciling && isFilteredByImportBatch && (
        <Alert
          type="info"
          showIcon
          title={
            <span>
              Showing transactions from this import batch.{' '}
              <a
                style={{ color: COLORS.terracotta, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={clearImportBatchFilter}
              >
                Clear filter
              </a>
            </span>
          }
          style={{ borderRadius: 6 }}
        />
      )}

      {/* Unfinished reconciliation session banner */}
      {!isReconciling && hasUnfinishedSession && (
        <Alert
          type="warning"
          showIcon
          icon={<CheckCircleFilled />}
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>You have an unfinished reconciliation for this account.</span>
              <Space size={8}>
                <Button
                  size="small"
                  type="primary"
                  loading={reconLoading}
                  onClick={handleReconcileClick}
                  style={{ background: COLORS.sage, borderColor: COLORS.sage }}
                >
                  Resume
                </Button>
                <Button size="small" danger onClick={handleDiscardUnfinished}>
                  Discard
                </Button>
              </Space>
            </span>
          }
          style={{ borderRadius: 6 }}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Title level={3} style={{ margin: 0, color: COLORS.walnut, flexShrink: 0 }}>
          {isReconciling ? 'Reconciliation' : 'Transactions'}
        </Title>

        <Select
          style={{ minWidth: 220 }}
          placeholder="Select account"
          value={selectedAccountId ?? undefined}
          onChange={(val) => setSelectedAccountId(val)}
          options={accountOptions}
          disabled={isReconciling}
          showSearch
          filterOption={(input, option) =>
            (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
          }
        />

        {/* Period selector (hidden during reconciliation) */}
        {!isReconciling && (
          <PeriodSelector
            value={selectedSubPeriodId}
            onChange={(id) => setSelectedSubPeriodId(id)}
            periods={periods}
            allowClear
            loading={false}
            mode={periodMode}
            onModeChange={handleModeChange}
            schedules={schedules}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        )}

        {/* Last reconciled date + Reconcile button */}
        {!isReconciling && selectedAccountId != null && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {lastReconciledDate
                ? `Last reconciled: ${dayjs(lastReconciledDate).format('MMM D, YYYY')}`
                : 'Never reconciled'}
            </Text>
            <Dropdown.Button
              menu={{
                items: [
                  { key: 'start', label: 'Start Reconciliation' },
                  { key: 'history', label: 'View History' },
                ] as MenuProps['items'],
                onClick: ({ key }: { key: string }) => {
                  if (key === 'start') setReconPhase('setup')
                  if (key === 'history') setHistoryOpen(true)
                },
              }}
              onClick={() => setReconPhase('setup')}
              loading={reconLoading}
              disabled={selectedAccountId == null}
            >
              Reconcile
            </Dropdown.Button>
          </div>
        )}
      </div>

      {/* ─── Reconciliation view ─────────────────────────────────────────── */}
      {isReconciling && reconSession && (
        <>
          <div ref={headerRef}>
            <ReconciliationHeader
              statementBalanceCents={reconSession.statement_balance_cents}
              clearedBalanceCents={clearedBalanceCents}
              clearedDepositsCents={clearedDepositsCents}
              clearedPaymentsCents={clearedPaymentsCents}
            />
          </div>

          {/* Inline add for forgotten transactions during reconciliation */}
          {selectedAccountId != null && (
            <InlineAddRow
              accountId={selectedAccountId}
              periodId={null}
            />
          )}

          <div ref={tableRef}>
            <ReconciliationTable
              transactions={reconTransactions}
              clearedIds={clearedIds}
              onToggleCleared={handleToggleCleared}
              loading={reconLoading}
              focusedId={focusedTxId ?? undefined}
            />
          </div>

          <div ref={finishBtnRef}>
            <ReconciliationFooter
              canFinish={canFinishReconciliation}
              clearedCount={clearedIds.size}
              onFinish={handleFinishReconciliation}
              onCancel={handleCancelReconciliation}
              loading={finishLoading}
            />
          </div>

          <Tour open={tourOpen} onClose={handleTourClose} steps={tourSteps} />
        </>
      )}

      {/* ─── Normal transaction view ─────────────────────────────────────── */}
      {!isReconciling && (
        <>
          {/* Summary cards */}
          <ErrorBoundary label="Summary Cards">
            <LedgerSummaryCards summary={summary} isLoading={summaryLoading} />
          </ErrorBoundary>

          {/* Pending recurring transactions banner */}
          {selectedAccountId != null && (
            <ErrorBoundary label="Pending Recurring">
              <PendingRecurringBanner
                key={selectedAccountId}
                accountId={selectedAccountId}
                dateRange={dateRange}
              />
            </ErrorBoundary>
          )}

          {/* Filter bar */}
          <ErrorBoundary label="Filters">
            <LedgerFilterBar filters={filters} onFilterChange={setFilters} />
          </ErrorBoundary>

          {/* Inline add row */}
          {selectedAccountId != null && (
            <InlineAddRow
              accountId={selectedAccountId}
              periodId={selectedSubPeriodId}
            />
          )}

          {/* Transaction table */}
          <ErrorBoundary label="Transaction Table">
            <TransactionTable
              transactions={transactions}
              loading={txnLoading}
              onRowClick={openDrawer}
              onConfirm={handleConfirm}
              onBulkConfirm={handleBulkConfirm}
              onUpdateDate={handleUpdateDate}
              total={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={(newPage, newPageSize) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize)
                  setPage(1)
                } else {
                  setPage(newPage)
                }
              }}
            />
          </ErrorBoundary>

          {/* Edit drawer */}
          <TransactionDrawer
            open={drawerOpen}
            transaction={selectedTxn}
            isLocked={isLocked}
            onClose={closeDrawer}
          />
        </>
      )}

      {/* Reconciliation setup modal */}
      <ReconciliationSetup
        open={reconPhase === 'setup'}
        accountId={selectedAccountId}
        onStart={handleReconcileStart}
        onCancel={() => setReconPhase('idle')}
      />

      {/* Reconciliation history modal */}
      {selectedAccountId != null && (
        <ReconciliationHistory
          open={historyOpen}
          accountId={selectedAccountId}
          onClose={() => setHistoryOpen(false)}
          onUndoComplete={() => {/* TanStack Query auto-invalidates */}}
        />
      )}

      {/* Reconciliation summary modal */}
      {lastReconciledResult != null && selectedAccountId != null && (
        <ReconciliationSummary
          open={summaryOpen}
          statementDate={lastReconciledResult.statementDate}
          statementBalanceCents={lastReconciledResult.statementBalanceCents}
          reconciledCount={lastReconciledResult.reconciledCount}
          accountName={accounts.find((a) => a.id === selectedAccountId)?.name ?? ''}
          accounts={accounts}
          currentAccountId={selectedAccountId}
          onDone={handleSummaryDone}
          onReconcileAnother={handleReconcileAnother}
        />
      )}
    </Space>
  )
}
