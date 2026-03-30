'use client'

import { useState, useMemo } from 'react'
import { Button, Checkbox, Modal, Space, Spin, Tooltip, message } from 'antd'
import { CheckSquareOutlined, CopyOutlined } from '@ant-design/icons'
import type { BudgetSubPeriod, BudgetVarianceRow, BudgetPeriodStatus } from '@/lib/api/types'
import { useBudgetVariance, useCopyAllocations } from '@/lib/api/budget'
import { formatCurrency } from '@/lib/utils/money'

interface BudgetCopyActionsProps {
  currentSubPeriodId: number
  allSubPeriods: BudgetSubPeriod[]
  periodsWithStatus: BudgetPeriodStatus[]
  onCopyComplete: () => void
  disabled?: boolean
}

export function BudgetCopyActions({
  currentSubPeriodId,
  allSubPeriods,
  periodsWithStatus,
  onCopyComplete,
  disabled = false,
}: BudgetCopyActionsProps): React.JSX.Element | null {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [useActuals, setUseActuals] = useState(false)

  const copyAllocations = useCopyAllocations()

  // Find previous sub-period by sorting all sub-periods by start_date
  const sorted = useMemo(
    () => [...allSubPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [allSubPeriods],
  )
  const currentIndex = sorted.findIndex((sp) => sp.id === currentSubPeriodId)
  const previousSubPeriod = currentIndex > 0 ? sorted[currentIndex - 1] : null

  // Don't render if no previous period
  if (!previousSubPeriod) return null

  // Fetch previous period's variance data (enabled only when modal is open)
  const prevVariance = useBudgetVariance(modalOpen ? previousSubPeriod.id : 0)

  // Check if the previous period is closed
  const prevStatus = periodsWithStatus.find((s) => s.id === previousSubPeriod.id)
  const prevIsClosed = prevStatus?.closed_at != null

  // Filter leaf rows with allocations or spend for the checklist
  const varianceRows = useMemo(() => {
    const rows = prevVariance.data?.data ?? []
    const parentIds = new Set(rows.filter((r) => r.parent_id !== null).map((r) => r.parent_id!))
    const leafRows = rows.filter((r) => !parentIds.has(r.category_id))
    return leafRows.filter((r) => r.initial_budget_cents > 0 || r.total_spent_cents > 0)
  }, [prevVariance.data])

  // ─── Copy All handler ──────────────────────────────────────────────────────

  async function handleCopyAll(): Promise<void> {
    try {
      await copyAllocations.mutateAsync({
        sourceSubPeriodId: previousSubPeriod!.id,
        targetSubPeriodId: currentSubPeriodId,
      })
      void message.success('Allocations copied from previous period')
      onCopyComplete()
    } catch (err) {
      console.error('Copy all failed:', err)
      void message.error('Failed to copy allocations. Please try again.')
    }
  }

  // ─── Select & Copy modal handlers ─────────────────────────────────────────

  function handleOpenModal(): void {
    setModalOpen(true)
    setUseActuals(false)
    setSelectedIds([])
  }

  // Auto-select all rows when variance data loads
  const allRowIds = useMemo(
    () => varianceRows.map((r) => r.category_id),
    [varianceRows],
  )

  function handleSelectAll(): void {
    setSelectedIds(allRowIds)
  }

  function handleDeselectAll(): void {
    setSelectedIds([])
  }

  function handleToggleRow(categoryId: number, checked: boolean): void {
    setSelectedIds((prev) =>
      checked ? [...prev, categoryId] : prev.filter((id) => id !== categoryId),
    )
  }

  async function handleCopySelected(): Promise<void> {
    if (selectedIds.length === 0) return
    try {
      await copyAllocations.mutateAsync({
        sourceSubPeriodId: previousSubPeriod!.id,
        targetSubPeriodId: currentSubPeriodId,
        useActuals,
      })
      setModalOpen(false)
      void message.success('Selected allocations copied from previous period')
      onCopyComplete()
    } catch (err) {
      console.error('Copy selected failed:', err)
      void message.error('Failed to copy allocations. Please try again.')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: '6px 12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>
          Copy Previous Period
        </span>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => void handleCopyAll()}
          disabled={disabled || copyAllocations.isPending}
          loading={copyAllocations.isPending}
        >
          Copy All
        </Button>
        <Button
          size="small"
          icon={<CheckSquareOutlined />}
          onClick={handleOpenModal}
          disabled={disabled}
        >
          Select &amp; Copy
        </Button>
      </div>

      <Modal
        title="Copy from Previous Period"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="copy"
            type="primary"
            disabled={selectedIds.length === 0 || copyAllocations.isPending}
            loading={copyAllocations.isPending}
            onClick={() => void handleCopySelected()}
          >
            Copy Selected
          </Button>,
        ]}
        width={480}
      >
        {prevVariance.isLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin />
          </div>
        ) : (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            {/* Select all / deselect all controls */}
            <Space size={8}>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Space>

            {/* Category checklist */}
            <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
              {varianceRows.length === 0 ? (
                <div style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>
                  No allocations found in previous period.
                </div>
              ) : (
                varianceRows.map((row) => {
                  const amount = useActuals ? row.total_spent_cents : row.initial_budget_cents
                  return (
                    <div
                      key={row.category_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.includes(row.category_id)}
                        onChange={(e) => handleToggleRow(row.category_id, e.target.checked)}
                      >
                        {row.category_name}
                      </Checkbox>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#555' }}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            {/* Use actuals checkbox */}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
              <Tooltip
                title={!prevIsClosed ? 'Previous period must be finalized to use actual amounts' : undefined}
              >
                <Checkbox
                  checked={useActuals}
                  disabled={!prevIsClosed}
                  onChange={(e) => setUseActuals(e.target.checked)}
                >
                  Use actuals instead of budgeted
                </Checkbox>
              </Tooltip>
            </div>
          </Space>
        )}
      </Modal>
    </>
  )
}

export default BudgetCopyActions
