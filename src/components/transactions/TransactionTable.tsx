'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Avatar, Button, DatePicker, Dropdown, InputNumber, message, Popconfirm, Switch, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface'
import type { MenuProps } from 'antd'
import {
  CheckCircleFilled,
  CheckOutlined,
  EyeInvisibleOutlined,
  RetweetOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { TransactionRow } from '@/lib/api/types'
import { useCategories } from '@/lib/api/categories'
import { useVendors } from '@/lib/api/vendors'
import { useMembers } from '@/lib/api/members'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'
import { RecurringBadge } from '@/components/recurring/RecurringBadge'

// ─── Inline amount cell for Expected entries ───────────────────────────────────

interface InlineAmountCellProps {
  record: TransactionRow
  onConfirm: (txId: number, amountCents: number, date: string) => Promise<void>
}

function InlineAmountCell({ record, onConfirm }: InlineAmountCellProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState<number | null>(record.amount_cents / 100)
  const inputRef = useRef<HTMLInputElement>(null) as React.RefObject<never>

  const isExpected = record.recurring_status === 'expected'
  const isDebit = record.is_debit === 1
  const color = isDebit ? COLORS.terracotta : COLORS.sage
  // UX-04: use "expense"/"income" not "debit"/"credit"
  const label = isDebit ? 'expense' : 'income'

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (inputVal == null) return
    const amountCents = Math.round(inputVal * 100)
    setEditing(false)
    await onConfirm(record.id, amountCents, record.date)
  }, [inputVal, record, onConfirm])

  if (!isExpected) {
    return (
      <div style={{ textAlign: 'right' }}>
        <div style={{ color, fontFamily: MONEY_FONT, fontWeight: 500 }}>
          {isDebit ? '-' : '+'}{formatCurrency(record.amount_cents)}
        </div>
        <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>{label}</div>
      </div>
    )
  }

  if (editing) {
    return (
      <InputNumber
        ref={inputRef}
        autoFocus
        prefix="$"
        precision={2}
        min={0}
        value={inputVal}
        onChange={(val) => setInputVal(val)}
        onPressEnter={handleConfirm}
        onBlur={handleConfirm}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setInputVal(record.amount_cents / 100)
            setEditing(false)
          }
        }}
        size="small"
        style={{ width: 110 }}
      />
    )
  }

  // Expected entry — clickable to edit
  return (
    <Tooltip title="Click to confirm with actual amount">
      <div
        style={{ textAlign: 'right', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
      >
        <div style={{ color, fontFamily: MONEY_FONT, fontWeight: 500, fontStyle: 'italic', opacity: 0.75 }}>
          {isDebit ? '-' : '+'}{formatCurrency(record.amount_cents)}
        </div>
        <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>expected</div>
      </div>
    </Tooltip>
  )
}

// ─── Inline date cell for Expected entries ────────────────────────────────────

interface InlineDateCellProps {
  record: TransactionRow
  onDateChange: (txId: number, date: string) => Promise<void>
}

function InlineDateCell({ record, onDateChange }: InlineDateCellProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const isExpected = record.recurring_status === 'expected'

  if (!isExpected) {
    return <span>{dayjs(record.date).format('MMM D, YYYY')}</span>
  }

  if (editing) {
    return (
      <DatePicker
        autoFocus
        size="small"
        defaultValue={dayjs(record.date)}
        onChange={async (date) => {
          if (date) {
            await onDateChange(record.id, date.format('YYYY-MM-DD'))
          }
          setEditing(false)
        }}
        onBlur={() => setEditing(false)}
        style={{ width: 130 }}
      />
    )
  }

  return (
    <Tooltip title="Click to change date">
      <span
        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
      >
        {dayjs(record.date).format('MMM D, YYYY')}
      </span>
    </Tooltip>
  )
}

// ─── TransactionTable component ───────────────────────────────────────────────

interface TransactionTableProps {
  transactions: TransactionRow[]
  loading: boolean
  onRowClick: (transaction: TransactionRow) => void
  onConfirm?: (txId: number, amountCents: number, date?: string) => Promise<void>
  onBulkConfirm?: (txIds: number[]) => Promise<void>
  onUpdateDate?: (txId: number, date: string) => Promise<void>
  onMakeRecurring?: (transaction: TransactionRow) => void
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number, pageSize: number) => void
}

/**
 * Transaction ledger table with:
 * - Running balance per row
 * - TXNS-04: Voided transaction strikethrough + "Show voided" toggle
 * - UX-04: "expense"/"income" labels (not debit/credit)
 * - Inline confirm for expected recurring entries
 * - Context menu with "Make Recurring"
 * - Client-side category/vendor/member lookups (API doesn't denormalize)
 */
export function TransactionTable({
  transactions,
  loading,
  onRowClick,
  onConfirm,
  onBulkConfirm,
  onUpdateDate,
  onMakeRecurring,
  total,
  page,
  pageSize,
  onPageChange,
}: TransactionTableProps): React.JSX.Element {
  const { data: groups = [] } = useCategories()
  const { data: vendors = [] } = useVendors()
  const { data: members = [] } = useMembers()

  const hasMembers = members.filter((m) => m.archived_at == null).length > 0

  // TXNS-04: "Show voided" toggle — hidden by default
  const [showVoided, setShowVoided] = useState(false)

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set())
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set())

  // Build lookup maps for category, vendor, member names
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const g of groups) {
      for (const c of g.categories) {
        map.set(c.id, `${g.name} / ${c.name}`)
      }
    }
    return map
  }, [groups])

  const vendorMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const v of vendors) {
      map.set(v.id, v.name)
    }
    return map
  }, [vendors])

  const memberMap = useMemo(() => {
    const map = new Map<number, { name: string; initials: string; color: string | null }>()
    for (const m of members) {
      map.set(m.id, { name: m.name, initials: m.initials, color: m.color })
    }
    return map
  }, [members])

  // TXNS-04: filter voided transactions unless toggle is on
  const visibleTransactions = useMemo(() => {
    if (showVoided) return transactions
    return transactions.filter((t) => t.voided_at == null)
  }, [transactions, showVoided])

  const voidedCount = transactions.filter((t) => t.voided_at != null).length

  // Flash row green briefly after confirm
  const flashRow = useCallback((txId: number): void => {
    setFlashIds((prev) => new Set(prev).add(txId))
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev)
        next.delete(txId)
        return next
      })
    }, 1200)
  }, [])

  const handleInlineConfirm = useCallback(
    async (txId: number, amountCents: number, date: string): Promise<void> => {
      if (!onConfirm) return
      try {
        setConfirmingIds((prev) => new Set(prev).add(txId))
        await onConfirm(txId, amountCents, date)
        flashRow(txId)

        const tx = transactions.find((t) => t.id === txId)
        if (tx && tx.estimated_amount_cents != null && amountCents !== tx.estimated_amount_cents) {
          const diff = amountCents - tx.estimated_amount_cents
          const diffFmt = `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))}`
          message.info({
            content: `Confirmed ${diffFmt} from estimate`,
            duration: 4,
          })
        }
      } finally {
        setConfirmingIds((prev) => {
          const next = new Set(prev)
          next.delete(txId)
          return next
        })
      }
    },
    [onConfirm, transactions, flashRow],
  )

  const handleOneClickConfirm = useCallback(
    async (e: React.MouseEvent, tx: TransactionRow): Promise<void> => {
      e.stopPropagation()
      if (!onConfirm) return
      try {
        setConfirmingIds((prev) => new Set(prev).add(tx.id))
        await onConfirm(tx.id, tx.amount_cents, tx.date)
        flashRow(tx.id)
      } finally {
        setConfirmingIds((prev) => {
          const next = new Set(prev)
          next.delete(tx.id)
          return next
        })
      }
    },
    [onConfirm, flashRow],
  )

  const handleBulkConfirm = useCallback(async (): Promise<void> => {
    if (!onBulkConfirm) return
    const expectedIds = (selectedRowKeys as number[]).filter((id) => {
      const tx = transactions.find((t) => t.id === id)
      return tx?.recurring_status === 'expected'
    })
    if (expectedIds.length === 0) return
    await onBulkConfirm(expectedIds)
    expectedIds.forEach((id) => flashRow(id))
    setSelectedRowKeys([])
    message.success(`Confirmed ${expectedIds.length} entr${expectedIds.length === 1 ? 'y' : 'ies'}`)
  }, [onBulkConfirm, selectedRowKeys, transactions, flashRow])

  const handleDateChange = useCallback(
    async (txId: number, date: string): Promise<void> => {
      if (onUpdateDate) {
        await onUpdateDate(txId, date)
      }
    },
    [onUpdateDate],
  )

  const rowSelection: TableRowSelection<TransactionRow> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: record.id === -1 || record.id === 0,
      style: record.id === -1 || record.id === 0 ? { display: 'none' } : undefined,
    }),
  }

  const selectedExpectedCount = (selectedRowKeys as number[]).filter((id) => {
    const tx = transactions.find((t) => t.id === id)
    return tx?.recurring_status === 'expected'
  }).length

  const pendingDividerId = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const hasPending = visibleTransactions.some((t) => t.id > 0 && t.date > today)
    if (!hasPending) return null
    const firstRealized = visibleTransactions.find((t) => t.id > 0 && t.date <= today)
    return firstRealized?.id ?? null
  }, [visibleTransactions])

  const columns: ColumnsType<TransactionRow> = [
    {
      title: '',
      key: 'recurring_badge',
      width: 30,
      align: 'center' as const,
      render: (_: unknown, record: TransactionRow) =>
        record.id > 0 && record.recurring_template_id != null ? (
          <RecurringBadge templateId={record.recurring_template_id} />
        ) : null,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (_: string, record: TransactionRow) => {
        // TXNS-04: Voided date badge
        if (record.voided_at) {
          return (
            <span style={{ textDecoration: 'line-through', color: '#aaa' }}>
              {dayjs(record.date).format('MMM D, YYYY')}
              <Tag color="default" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                <EyeInvisibleOutlined /> Voided {dayjs(record.voided_at).format('M/D')}
              </Tag>
            </span>
          )
        }
        const isFuture = record.date > new Date().toISOString().slice(0, 10)
        if (onUpdateDate) {
          return (
            <span>
              <InlineDateCell record={record} onDateChange={handleDateChange} />
              {isFuture && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>Pending</Tag>}
            </span>
          )
        }
        return (
          <span>
            {dayjs(record.date).format('MMM D, YYYY')}
            {isFuture && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>Pending</Tag>}
          </span>
        )
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string, record: TransactionRow) => {
        if (record.voided_at) {
          return <span style={{ textDecoration: 'line-through', color: '#aaa' }}>{text}</span>
        }
        return text
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount_cents',
      key: 'amount_cents',
      width: 150,
      align: 'right',
      render: (_: number, record: TransactionRow) => {
        if (record.id === -1 || record.id === 0) return null
        // TXNS-04: muted for voided
        if (record.voided_at) {
          return (
            <div style={{ textAlign: 'right', textDecoration: 'line-through', color: '#aaa' }}>
              <div style={{ fontFamily: MONEY_FONT, fontWeight: 500 }}>
                {record.is_debit === 1 ? '-' : '+'}{formatCurrency(record.amount_cents)}
              </div>
            </div>
          )
        }
        return onConfirm ? (
          <InlineAmountCell record={record} onConfirm={handleInlineConfirm} />
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                color: record.is_debit === 1 ? COLORS.terracotta : COLORS.sage,
                fontFamily: MONEY_FONT,
                fontWeight: 500,
              }}
            >
              {record.is_debit === 1 ? '-' : '+'}{formatCurrency(record.amount_cents)}
            </div>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase' }}>
              {record.is_debit === 1 ? 'expense' : 'income'}
            </div>
          </div>
        )
      },
    },
    {
      title: 'Category',
      key: 'category_name',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: TransactionRow) => {
        const name = record.category_id ? categoryMap.get(record.category_id) : null
        return name ?? <span style={{ color: '#bbb' }}>—</span>
      },
    },
    {
      title: 'Payee',
      key: 'vendor_name',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: TransactionRow) => {
        const name = record.vendor_id ? vendorMap.get(record.vendor_id) : null
        return name ?? <span style={{ color: '#bbb' }}>—</span>
      },
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      align: 'center' as const,
      render: (_: unknown, record: TransactionRow) => {
        if (record.recurring_status === 'expected' && onConfirm) {
          return (
            <Popconfirm
              title="Confirm at current amount?"
              onConfirm={(e) => handleOneClickConfirm(e as unknown as React.MouseEvent, record)}
              okText="Confirm"
              cancelText="Cancel"
              placement="left"
            >
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                loading={confirmingIds.has(record.id)}
                title="Confirm at current amount"
                style={{ color: COLORS.sage }}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )
        }
        if (record.reconciled_at) {
          return (
            <CheckCircleFilled
              style={{ color: COLORS.sage, fontSize: 14 }}
              title="Reconciled"
            />
          )
        }
        return null
      },
    },
    ...(hasMembers
      ? ([
          {
            title: <TeamOutlined title="Member" />,
            key: 'member',
            width: 52,
            align: 'center' as const,
            render: (_: unknown, record: TransactionRow) => {
              if (!record.member_id) return <span style={{ color: '#ddd' }}>—</span>
              const member = memberMap.get(record.member_id)
              if (!member) return <span style={{ color: '#ddd' }}>—</span>
              return (
                <Avatar
                  size="small"
                  style={{
                    backgroundColor: member.color ?? '#aaa',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                >
                  {member.initials}
                </Avatar>
              )
            },
          },
        ] as ColumnsType<TransactionRow>)
      : []),
    {
      title: 'Balance',
      dataIndex: 'running_balance_cents',
      key: 'running_balance_cents',
      width: 130,
      align: 'right',
      render: (cents: number | null) => {
        if (cents == null) {
          return <span style={{ fontFamily: MONEY_FONT, color: '#ccc', fontSize: 13 }}>&mdash;</span>
        }
        return (
          <span
            style={{
              fontFamily: MONEY_FONT,
              color: cents >= 0 ? COLORS.walnut : COLORS.terracotta,
              fontWeight: 500,
            }}
          >
            {cents < 0 ? '-' : ''}{formatCurrency(Math.abs(cents))}
          </span>
        )
      },
    },
  ]

  const getContextMenuItems = useCallback(
    (record: TransactionRow): MenuProps['items'] => {
      if (record.id <= 0) return []
      const items: MenuProps['items'] = []

      if (record.recurring_template_id === null && onMakeRecurring) {
        items.push({
          key: 'make-recurring',
          label: 'Make Recurring',
          icon: <RetweetOutlined />,
          onClick: () => onMakeRecurring(record),
        })
      }

      return items
    },
    [onMakeRecurring],
  )

  return (
    <div>
      {/* TXNS-04: Show voided toggle */}
      {voidedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Switch
            size="small"
            checked={showVoided}
            onChange={setShowVoided}
          />
          <span style={{ fontSize: 12, color: COLORS.walnut }}>
            Show voided ({voidedCount})
          </span>
        </div>
      )}

      {/* Bulk confirm action bar */}
      {selectedExpectedCount > 0 && onBulkConfirm && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            background: `${COLORS.sage}15`,
            border: `1px solid ${COLORS.sage}40`,
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <RetweetOutlined style={{ color: COLORS.sage }} />
          <span style={{ color: COLORS.walnut, fontSize: 13 }}>
            {selectedExpectedCount} expected entr{selectedExpectedCount === 1 ? 'y' : 'ies'} selected
          </span>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleBulkConfirm}
            style={{ marginLeft: 'auto' }}
          >
            Confirm {selectedExpectedCount} {selectedExpectedCount === 1 ? 'entry' : 'entries'}
          </Button>
        </div>
      )}

      <Table<TransactionRow>
        dataSource={visibleTransactions}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        rowSelection={onBulkConfirm ? rowSelection : undefined}
        onRow={(record) => ({
          onClick: () => record.id > 0 && !record.voided_at && onRowClick(record),
          style: {
            cursor: record.id <= 0 || record.voided_at ? 'default' : 'pointer',
            // TXNS-04: muted colors for voided
            ...(record.voided_at ? { opacity: 0.5 } : {}),
          },
        })}
        rowClassName={(record, index) => {
          const classes: string[] = []
          if (record.id === -1 || record.id === 0) {
            classes.push('txn-row-starting-balance')
            return classes.join(' ')
          }
          if (record.voided_at) {
            classes.push('txn-row-voided')
            return classes.join(' ')
          }
          if (pendingDividerId != null && record.id === pendingDividerId) {
            classes.push('txn-row-pending-divider')
          }
          classes.push(index % 2 === 0 ? 'txn-row-even' : 'txn-row-odd')
          if (record.recurring_status === 'expected') {
            classes.push('txn-row-expected')
          }
          if (flashIds.has(record.id)) {
            classes.push('txn-row-flash')
          }
          return classes.join(' ')
        }}
        pagination={
          onPageChange && total != null && page != null && pageSize != null
            ? {
                current: page,
                pageSize: pageSize,
                total: total,
                onChange: onPageChange,
                showSizeChanger: true,
                showTotal: (t) => {
                  const hasStarting = visibleTransactions.some((tx) => tx.id === -1 || tx.id === 0)
                  return `${hasStarting ? t - 1 : t} transactions`
                },
              }
            : {
                pageSize: 50,
                showSizeChanger: true,
                showTotal: (t) => {
                  const hasStarting = visibleTransactions.some((tx) => tx.id === -1 || tx.id === 0)
                  return `${hasStarting ? t - 1 : t} transactions`
                },
              }
        }
        locale={{ emptyText: 'No transactions for this account and period' }}
        components={
          onMakeRecurring
            ? {
                body: {
                  row: ({
                    children,
                    ...props
                  }: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string }) => {
                    const rowKey = props['data-row-key']
                    const record = visibleTransactions.find((t) => String(t.id) === rowKey)
                    if (!record) return <tr {...props}>{children}</tr>
                    const menuItems = getContextMenuItems(record)
                    if (!menuItems || menuItems.length === 0) {
                      return <tr {...props}>{children}</tr>
                    }
                    return (
                      <Dropdown
                        menu={{ items: menuItems }}
                        trigger={['contextMenu']}
                      >
                        <tr {...props}>{children}</tr>
                      </Dropdown>
                    )
                  },
                },
              }
            : undefined
        }
      />

      {/* Inline CSS for row styling */}
      <style>{`
        .txn-row-expected td {
          background-color: rgba(152, 96, 40, 0.06) !important;
        }
        .txn-row-expected:hover td {
          background-color: rgba(152, 96, 40, 0.10) !important;
        }
        .txn-row-flash td {
          background-color: rgba(86, 117, 89, 0.18) !important;
          transition: background-color 0.3s ease;
        }
        .txn-row-pending-divider td {
          border-top: 2px solid #d9d1c7 !important;
        }
        .txn-row-starting-balance td {
          background-color: rgba(139, 115, 85, 0.08) !important;
          font-weight: 600;
          font-style: italic;
        }
        .txn-row-starting-balance:hover td {
          background-color: rgba(139, 115, 85, 0.08) !important;
        }
        .txn-row-voided td {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
      `}</style>
    </div>
  )
}
