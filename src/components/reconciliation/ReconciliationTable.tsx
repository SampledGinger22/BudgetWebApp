'use client'

import { Checkbox, Input, InputNumber, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { TransactionRow } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS, MONEY_FONT } from '@/theme'

const { Text } = Typography

interface ReconciliationTableProps {
  transactions: TransactionRow[]
  clearedIds: Set<number>
  onToggleCleared: (transactionId: number) => void
  loading: boolean
  focusedId?: number
}

/**
 * Reconciliation table with checkboxes for clearing transactions.
 * Split into Deposits and Payments sections with per-section check-all.
 */
export function ReconciliationTable({
  transactions,
  clearedIds,
  onToggleCleared,
  loading,
  focusedId,
}: ReconciliationTableProps): React.JSX.Element {
  const [descSearch, setDescSearch] = useState('')
  const [amountFilter, setAmountFilter] = useState<string>('')

  const filtered = transactions.filter((tx) => {
    const matchDesc = descSearch
      ? tx.description.toLowerCase().includes(descSearch.toLowerCase())
      : true
    const matchAmount = amountFilter
      ? tx.amount_cents === Math.round(parseFloat(amountFilter) * 100)
      : true
    return matchDesc && matchAmount
  })

  const deposits = filtered.filter((tx) => tx.is_debit === 0)
  const payments = filtered.filter((tx) => tx.is_debit === 1)

  const makeSectionCheckAll = (sectionTxns: TransactionRow[]) => {
    const allCleared = sectionTxns.length > 0 && sectionTxns.every((t) => clearedIds.has(t.id))
    const noneCleared = sectionTxns.length > 0 && sectionTxns.every((t) => !clearedIds.has(t.id))
    const indeterminate = !allCleared && !noneCleared && sectionTxns.length > 0
    return { allCleared, indeterminate }
  }

  const toggleAllInSection = (sectionTxns: TransactionRow[], checked: boolean): void => {
    for (const tx of sectionTxns) {
      const isCurrentlyCleared = clearedIds.has(tx.id)
      if (checked && !isCurrentlyCleared) {
        onToggleCleared(tx.id)
      } else if (!checked && isCurrentlyCleared) {
        onToggleCleared(tx.id)
      }
    }
  }

  const makeColumns = (sectionTxns: TransactionRow[]): ColumnsType<TransactionRow> => {
    const { allCleared, indeterminate } = makeSectionCheckAll(sectionTxns)
    return [
      {
        title: (
          <Checkbox
            checked={allCleared}
            indeterminate={indeterminate}
            onChange={(e) => toggleAllInSection(sectionTxns, e.target.checked)}
          />
        ),
        key: 'checkbox',
        width: 40,
        render: (_: unknown, record: TransactionRow) => (
          <Checkbox
            checked={clearedIds.has(record.id)}
            onChange={() => onToggleCleared(record.id)}
          />
        ),
      },
      {
        title: 'Date',
        key: 'date',
        width: 120,
        sorter: (a: TransactionRow, b: TransactionRow) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
        defaultSortOrder: 'ascend' as const,
        render: (_: unknown, record: TransactionRow) => (
          <Text style={{ fontSize: 13 }}>
            {dayjs(record.date).format('MMM D, YYYY')}
          </Text>
        ),
      },
      {
        title: 'Description',
        key: 'description',
        ellipsis: true,
        sorter: (a: TransactionRow, b: TransactionRow) => a.description.localeCompare(b.description),
        render: (_: unknown, record: TransactionRow) => (
          <Text style={{ fontSize: 13 }} ellipsis>
            {record.description}
          </Text>
        ),
      },
      {
        title: 'Amount',
        key: 'amount',
        width: 120,
        align: 'right',
        sorter: (a: TransactionRow, b: TransactionRow) => a.amount_cents - b.amount_cents,
        render: (_: unknown, record: TransactionRow) => (
          <Text
            style={{
              fontSize: 13,
              fontFamily: MONEY_FONT,
              color: record.is_debit ? COLORS.terracotta : COLORS.sage,
            }}
          >
            {record.is_debit ? '-' : '+'}{formatCurrency(record.amount_cents)}
          </Text>
        ),
      },
    ]
  }

  const rowClassName = (record: TransactionRow): string => {
    const classes: string[] = []
    if (clearedIds.has(record.id)) classes.push('recon-row-cleared')
    if (record.id === focusedId) classes.push('recon-row-focused')
    return classes.join(' ')
  }

  const usePagination = transactions.length > 100

  return (
    <div>
      <style>{`
        .recon-row-cleared td { background-color: rgba(86, 117, 89, 0.08) !important; }
        .recon-row-focused td { outline: 2px solid rgba(92, 61, 30, 0.3) !important; outline-offset: -2px; }
      `}</style>

      {/* Search and filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <Input.Search
          placeholder="Search by description..."
          allowClear
          onChange={(e) => setDescSearch(e.target.value)}
          style={{ width: 260 }}
          size="small"
        />
        <InputNumber
          placeholder="Amount ($)"
          precision={2}
          prefix="$"
          style={{ width: 160 }}
          size="small"
          onChange={(val) => setAmountFilter(val != null ? String(val) : '')}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {filtered.length} of {transactions.length} transactions
        </Text>
      </div>

      {/* Deposits section */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 14, color: COLORS.walnut, display: 'block', marginBottom: 8 }}>
          Deposits ({deposits.length})
        </Text>
        <Table<TransactionRow>
          columns={makeColumns(deposits)}
          dataSource={deposits}
          rowKey="id"
          rowClassName={rowClassName}
          loading={loading}
          size="small"
          pagination={usePagination ? { pageSize: 50, showSizeChanger: false } : false}
        />
      </div>

      {/* Payments section */}
      <div>
        <Text strong style={{ fontSize: 14, color: COLORS.walnut, display: 'block', marginBottom: 8 }}>
          Payments ({payments.length})
        </Text>
        <Table<TransactionRow>
          columns={makeColumns(payments)}
          dataSource={payments}
          rowKey="id"
          rowClassName={rowClassName}
          loading={loading}
          size="small"
          pagination={usePagination ? { pageSize: 50, showSizeChanger: false } : false}
        />
      </div>
    </div>
  )
}
