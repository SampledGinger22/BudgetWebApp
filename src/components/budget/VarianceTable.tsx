'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import {
  Avatar,
  InputNumber,
  Popover,
  Progress,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useRouter } from 'next/navigation'
import type { BudgetTransfer, BudgetVarianceRow } from '@/lib/api/types'
import { useAllocateBudget, useCreateTransfer } from '@/lib/api/budget'
import { useMembers } from '@/lib/api/members'
import { useSchedules } from '@/lib/api/periods'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency, centsToDollars, dollarsToCents } from '@/lib/utils/money'

const { Text } = Typography

// ─── Table row type ───────────────────────────────────────────────────────────

type RowLevel = 'group' | 'parent' | 'leaf'

interface VarianceTableRow {
  key: string
  level: RowLevel
  categoryId: number | null
  name: string
  group_id: number
  group_name: string
  initial_budget_cents: number
  net_transfers_cents: number
  total_spent_cents: number
  remaining_cents: number
  expected_cents: number
  member_spend?: Array<{
    member_id: number
    member_name: string | null
    member_initials: string | null
    spent_cents: number
  }>
  children?: VarianceTableRow[]
}

// ─── Tree builder ─────────────────────────────────────────────────────────────
// S06 types: category_group_id / category_group_name (not group_id / group_name)

function buildTree(rows: BudgetVarianceRow[]): VarianceTableRow[] {
  const byGroup = new Map<number, BudgetVarianceRow[]>()
  for (const row of rows) {
    const list = byGroup.get(row.category_group_id) ?? []
    list.push(row)
    byGroup.set(row.category_group_id, list)
  }

  const result: VarianceTableRow[] = []

  for (const [, groupRows] of byGroup) {
    if (groupRows.length === 0) continue

    const parents = groupRows.filter((r) => r.parent_id === null)
    const children = groupRows.filter((r) => r.parent_id !== null)

    const groupName = groupRows[0].category_group_name
    const groupId = groupRows[0].category_group_id

    const parentTableRows: VarianceTableRow[] = parents.map((parent) => {
      const subs = children.filter((c) => c.parent_id === parent.category_id)
      const subRows: VarianceTableRow[] = subs.map((sub) => ({
        key: `leaf-${sub.category_id}`,
        level: 'leaf' as RowLevel,
        categoryId: sub.category_id,
        name: sub.category_name,
        group_id: sub.category_group_id,
        group_name: sub.category_group_name,
        initial_budget_cents: sub.initial_budget_cents,
        net_transfers_cents: sub.net_transfers_cents,
        total_spent_cents: sub.total_spent_cents,
        remaining_cents: sub.remaining_cents,
        expected_cents: sub.expected_cents,
        member_spend: sub.member_spend,
      }))

      const level: RowLevel = subs.length > 0 ? 'parent' : 'leaf'

      return {
        key: `${level === 'parent' ? 'parent' : 'leaf'}-${parent.category_id}`,
        level,
        categoryId: parent.category_id,
        name: parent.category_name,
        group_id: parent.category_group_id,
        group_name: parent.category_group_name,
        initial_budget_cents: parent.initial_budget_cents,
        net_transfers_cents: parent.net_transfers_cents,
        total_spent_cents: parent.total_spent_cents,
        remaining_cents: parent.remaining_cents,
        expected_cents: parent.expected_cents,
        member_spend: parent.member_spend,
        children: subRows.length > 0 ? subRows : undefined,
      }
    })

    const totalInitial = groupRows.reduce((s, r) => s + r.initial_budget_cents, 0)
    const totalTransfers = groupRows.reduce((s, r) => s + r.net_transfers_cents, 0)
    const totalSpent = groupRows.reduce((s, r) => s + r.total_spent_cents, 0)
    const totalRemaining = groupRows.reduce((s, r) => s + r.remaining_cents, 0)
    const totalExpected = groupRows.reduce((s, r) => s + r.expected_cents, 0)

    result.push({
      key: `group-${groupId}`,
      level: 'group',
      categoryId: null,
      name: groupName,
      group_id: groupId,
      group_name: groupName,
      initial_budget_cents: totalInitial,
      net_transfers_cents: totalTransfers,
      total_spent_cents: totalSpent,
      remaining_cents: totalRemaining,
      expected_cents: totalExpected,
      children: parentTableRows.length > 0 ? parentTableRows : undefined,
    })
  }

  return result
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

interface EditableCellProps {
  record: VarianceTableRow
  editingKey: string | null
  setEditingKey: (key: string | null) => void
  onSave: (categoryId: number, cents: number) => Promise<void>
}

function EditableAllocationCell({
  record,
  editingKey,
  setEditingKey,
  onSave,
}: EditableCellProps): React.JSX.Element {
  const isEditable = record.level !== 'group'
  const isEditing = editingKey === record.key
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!isEditable) {
    return (
      <Text style={{ fontFamily: MONEY_FONT, color: COLORS.walnut }}>
        {formatCurrency(record.initial_budget_cents)}
      </Text>
    )
  }

  if (!isEditing) {
    return (
      <div
        onClick={() => setEditingKey(record.key)}
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 4,
          transition: 'background 0.15s',
        }}
        title="Click to edit allocation"
      >
        <Text style={{ fontFamily: MONEY_FONT, color: COLORS.walnut }}>
          {formatCurrency(record.initial_budget_cents)}
        </Text>
      </div>
    )
  }

  const handleChange = (val: number | null): void => {
    if (val == null || record.categoryId == null) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSave(record.categoryId!, dollarsToCents(val))
    }, 300)
  }

  const handleBlur = (): void => {
    setEditingKey(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingKey(null)
    }
  }

  return (
    <InputNumber
      autoFocus
      prefix="$"
      precision={2}
      min={0}
      defaultValue={centsToDollars(record.initial_budget_cents)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      size="small"
      style={{ width: 110 }}
    />
  )
}

// ─── Progress bar cell ────────────────────────────────────────────────────────

function ProgressCell({ record }: { record: VarianceTableRow }): React.JSX.Element {
  const adjustedBudget = record.initial_budget_cents + record.net_transfers_cents
  if (record.level === 'group' || adjustedBudget <= 0) {
    return <span />
  }

  const pct = Math.min(Math.round((record.total_spent_cents / adjustedBudget) * 100), 100)
  const isOver = record.total_spent_cents > adjustedBudget

  return (
    <Progress
      percent={pct}
      size="small"
      showInfo={false}
      strokeLinecap="butt"
      strokeColor={
        isOver
          ? COLORS.terracotta
          : { '0%': '#8B6BA8', '100%': '#1a1a1a' }
      }
      style={{ minWidth: 80, marginBottom: 0 }}
    />
  )
}

// ─── Member spend badges ──────────────────────────────────────────────────────

function MemberSpendBadges({ record }: { record: VarianceTableRow }): React.JSX.Element {
  if (record.level !== 'leaf' || !record.member_spend || record.member_spend.length === 0) {
    return <span />
  }
  if (record.total_spent_cents <= 0) {
    return <span />
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {record.member_spend.map((ms) => {
        const pct = Math.round((ms.spent_cents / record.total_spent_cents) * 100)
        const initials = ms.member_initials ?? '?'
        return (
          <Tag
            key={ms.member_id}
            style={{
              padding: '1px 6px',
              border: 'none',
              borderRadius: 12,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#e0d8c822',
              color: COLORS.walnut,
              fontWeight: 600,
            }}
          >
            <Avatar
              size={14}
              style={{
                backgroundColor: COLORS.copper,
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            {pct}%
          </Tag>
        )
      })}
    </div>
  )
}

// ─── VarianceTable component ──────────────────────────────────────────────────

interface VarianceTableProps {
  rows: BudgetVarianceRow[]
  loading?: boolean
  selectedSubPeriodId: number | null
  subPeriodId: number
  transfers?: BudgetTransfer[]
  onTransferFromCategory?: (categoryId: number) => void
}

export function VarianceTable({
  rows,
  loading,
  selectedSubPeriodId,
  subPeriodId,
  transfers,
  onTransferFromCategory,
}: VarianceTableProps): React.JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [includeExpected, setIncludeExpected] = useState(false)
  const router = useRouter()
  const allocateBudget = useAllocateBudget()
  const { data: members } = useMembers()
  const { data: schedulesResp } = useSchedules()

  const hasMembers = (members ?? []).length > 0

  // Build income-by-category lookup from schedules
  const incomeByCategory = useMemo(() => {
    const schedules = schedulesResp?.data ?? schedulesResp ?? []
    const map = new Map<number, { scheduleName: string; expectedCents: number }>()
    if (!Array.isArray(schedules)) return map
    for (const s of schedules as Array<{ income_category_id?: number | null; amount_cents?: number | null; name: string }>) {
      if (s.income_category_id != null && s.amount_cents != null) {
        const existing = map.get(s.income_category_id)
        if (existing) {
          existing.expectedCents += s.amount_cents
        } else {
          map.set(s.income_category_id, {
            scheduleName: s.name,
            expectedCents: s.amount_cents,
          })
        }
      }
    }
    return map
  }, [schedulesResp])

  const handleSave = useCallback(
    async (categoryId: number, cents: number) => {
      await allocateBudget.mutateAsync({
        budget_sub_period_id: subPeriodId,
        category_id: categoryId,
        allocated_cents: cents,
      })
    },
    [allocateBudget, subPeriodId],
  )

  const treeData = buildTree(rows)

  const hasExpected = rows.some((r) => r.expected_cents > 0)

  // Totals for the summary footer
  const incomeCatIds = new Set(incomeByCategory.keys())
  const expenseRows = rows.filter((r) => r.category_id == null || !incomeCatIds.has(r.category_id))
  const totalInitial = expenseRows
    .filter((r) => r.parent_id === null)
    .reduce((s, r) => s + r.initial_budget_cents, 0)
  const totalTransfers = expenseRows.reduce((s, r) => s + r.net_transfers_cents, 0)
  const totalSpent = expenseRows.reduce((s, r) => s + r.total_spent_cents, 0)
  const totalRemaining = expenseRows.reduce((s, r) => s + r.remaining_cents, 0)
  const totalExpected = expenseRows.reduce((s, r) => s + r.expected_cents, 0)

  const effectiveTotalRemaining = includeExpected
    ? totalRemaining - totalExpected
    : totalRemaining

  const effectiveRemaining = (record: VarianceTableRow): number =>
    includeExpected ? record.remaining_cents - record.expected_cents : record.remaining_cents

  const columns: TableColumnsType<VarianceTableRow> = [
    {
      title: 'Category',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record: VarianceTableRow) => {
        const isGroup = record.level === 'group'
        const isLeaf = record.level === 'leaf'
        const isClickable = isLeaf && record.categoryId != null

        const incomeInfo = record.categoryId != null ? incomeByCategory.get(record.categoryId) : undefined

        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                fontWeight: isGroup ? 700 : record.level === 'parent' ? 600 : 400,
                fontSize: isGroup ? 11 : 14,
                color: isGroup ? COLORS.copper : COLORS.walnut,
                textTransform: isGroup ? 'uppercase' : undefined,
                letterSpacing: isGroup ? '0.05em' : undefined,
                cursor: isClickable ? 'pointer' : 'default',
              }}
            >
              {name}
              {isClickable && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    opacity: 0.4,
                    verticalAlign: 'middle',
                  }}
                >
                  &#x2197;
                </span>
              )}
            </Text>
            {incomeInfo != null && (
              <Tag color="blue" style={{ fontSize: 10, marginLeft: 6, lineHeight: '16px', padding: '0 4px' }}>
                Expected: {formatCurrency(incomeInfo.expectedCents)}
              </Tag>
            )}
            {record.level === 'parent' && record.children && record.children.length > 0 && (() => {
              const childrenBudgetSum = record.children.reduce((s, c) => s + c.initial_budget_cents, 0)
              const available = record.initial_budget_cents - childrenBudgetSum - record.total_spent_cents
              return (
                <Tag
                  style={{
                    fontSize: 10,
                    marginLeft: 6,
                    lineHeight: '16px',
                    padding: '0 4px',
                    border: 'none',
                    background: available > 0 ? `${COLORS.sage}22` : `${COLORS.terracotta}22`,
                    color: available > 0 ? COLORS.sage : COLORS.terracotta,
                  }}
                >
                  {formatCurrency(available)} unassigned
                </Tag>
              )
            })()}
            {record.level !== 'group' && onTransferFromCategory && record.categoryId != null && (
              <SwapOutlined
                className="transfer-hover-icon"
                style={{
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  fontSize: 12,
                  color: COLORS.walnut,
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onTransferFromCategory(record.categoryId!)
                }}
                title="Transfer from this category"
              />
            )}
          </span>
        )
      },
      onCell: (record: VarianceTableRow) => ({
        onClick: () => {
          if (record.level === 'leaf' && record.categoryId != null && selectedSubPeriodId != null) {
            router.push(
              `/transactions?category=${record.categoryId}&period=${selectedSubPeriodId}`,
            )
          }
        },
        style: {
          cursor: record.level === 'leaf' ? 'pointer' : 'default',
        },
      }),
    },
    {
      title: 'Initial Budget',
      key: 'initial_budget',
      width: 140,
      align: 'right',
      render: (_: unknown, record: VarianceTableRow) => (
        <EditableAllocationCell
          record={record}
          editingKey={editingKey}
          setEditingKey={setEditingKey}
          onSave={handleSave}
        />
      ),
    },
    {
      title: 'Net Transfers',
      key: 'net_transfers',
      width: 110,
      align: 'right',
      render: (_: unknown, record: VarianceTableRow) => {
        if (record.level !== 'leaf') {
          return (
            <Text style={{ fontFamily: MONEY_FONT, color: '#ccc', fontSize: 13 }}>
              {'\u2014'}
            </Text>
          )
        }

        const cents = record.net_transfers_cents

        if (cents === 0 || record.categoryId == null) {
          const prefix = cents > 0 ? '+' : cents < 0 ? '' : ''
          return (
            <Text
              style={{
                fontFamily: MONEY_FONT,
                color: cents === 0 ? '#aaa' : cents > 0 ? COLORS.sage : COLORS.terracotta,
                fontSize: 13,
              }}
            >
              {prefix}{formatCurrency(cents)}
            </Text>
          )
        }

        const relatedTransfers = (transfers ?? []).filter(
          (t) =>
            t.from_category_id === record.categoryId ||
            t.to_category_id === record.categoryId,
        )

        const popoverContent = (
          <div style={{ minWidth: 280 }}>
            {relatedTransfers.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                No transfer detail available
              </Text>
            ) : (
              relatedTransfers.map((t) => {
                const isIncoming = t.to_category_id === record.categoryId
                const counterpart = isIncoming ? t.from_category_name : t.to_category_name
                const amountDisplay = isIncoming
                  ? `+${formatCurrency(t.amount_cents)}`
                  : `-${formatCurrency(t.amount_cents)}`
                const date = new Date(t.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '3px 0',
                      fontSize: 12,
                      borderBottom: '1px solid #f0ebe0',
                    }}
                  >
                    <span style={{ color: '#888' }}>{date}</span>
                    <span style={{ color: COLORS.walnut }}>
                      {isIncoming ? '\u2190' : '\u2192'} {counterpart}
                    </span>
                    <span
                      style={{
                        fontFamily: MONEY_FONT,
                        fontWeight: 600,
                        color: isIncoming ? COLORS.sage : COLORS.terracotta,
                      }}
                    >
                      {amountDisplay}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )

        const prefix = cents > 0 ? '+' : ''
        return (
          <Popover content={popoverContent} title="Transfer Detail" trigger="click">
            <Text
              style={{
                fontFamily: MONEY_FONT,
                color: cents > 0 ? COLORS.sage : COLORS.terracotta,
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline dotted',
              }}
            >
              {prefix}{formatCurrency(cents)}
            </Text>
          </Popover>
        )
      },
    },
    ...(hasExpected
      ? ([
          {
            title: (
              <Tooltip title="Projected recurring transactions for this period (from templates)">
                <span style={{ cursor: 'help', borderBottom: '1px dotted #aaa' }}>Expected</span>
              </Tooltip>
            ),
            key: 'expected',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, record: VarianceTableRow) => (
              <Text
                style={{
                  fontFamily: MONEY_FONT,
                  color: record.expected_cents > 0 ? COLORS.copper : '#ccc',
                  fontSize: 13,
                  fontStyle: record.expected_cents > 0 ? 'italic' : 'normal',
                }}
              >
                {formatCurrency(record.expected_cents)}
              </Text>
            ),
          },
        ] as TableColumnsType<VarianceTableRow>)
      : []),
    {
      title: 'Total Spent',
      key: 'total_spent',
      width: 110,
      align: 'right',
      render: (_: unknown, record: VarianceTableRow) => (
        <Text
          style={{
            fontFamily: MONEY_FONT,
            color: record.total_spent_cents > 0 ? COLORS.terracotta : '#999',
            fontSize: 13,
          }}
        >
          {formatCurrency(record.total_spent_cents)}
        </Text>
      ),
    },
    {
      title: (
        <span>
          Remaining
          {hasExpected && (
            <Tooltip
              title={
                includeExpected
                  ? 'Click to exclude expected from remaining'
                  : 'Click to include expected amounts in remaining calculation'
              }
            >
              <Switch
                size="small"
                checked={includeExpected}
                onChange={setIncludeExpected}
                style={{ marginLeft: 8, verticalAlign: 'middle' }}
                onClick={(_, e) => e.stopPropagation()}
              />
            </Tooltip>
          )}
        </span>
      ),
      key: 'remaining',
      width: 140,
      align: 'right',
      render: (_: unknown, record: VarianceTableRow) => {
        const remaining = effectiveRemaining(record)
        return (
          <Text
            style={{
              fontFamily: MONEY_FONT,
              color: remaining >= 0 ? COLORS.sage : COLORS.terracotta,
              fontSize: 13,
              fontWeight: record.level !== 'leaf' ? 600 : 400,
            }}
          >
            {formatCurrency(remaining)}
          </Text>
        )
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 100,
      render: (_: unknown, record: VarianceTableRow) => <ProgressCell record={record} />,
    },
    ...(hasMembers
      ? [
          {
            title: 'By Member',
            key: 'member_spend',
            width: 140,
            render: (_: unknown, record: VarianceTableRow) => <MemberSpendBadges record={record} />,
          },
        ]
      : []),
  ]

  const summaryCols = 3 + (hasExpected ? 1 : 0) + 3 + (hasMembers ? 1 : 0)

  return (
    <div>
      <style>{`
        .variance-leaf-row:hover .transfer-hover-icon { opacity: 1 !important; }
      `}</style>

      {hasExpected && includeExpected && (
        <div
          style={{
            fontSize: 12,
            color: COLORS.copper,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontStyle: 'italic' }}>
            Remaining includes projected recurring deductions. Toggle off to see confirmed-only remaining.
          </span>
        </div>
      )}

      <Table<VarianceTableRow>
        dataSource={treeData}
        columns={columns}
        rowKey="key"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        indentSize={24}
        expandable={{
          defaultExpandAllRows: true,
        }}
        rowClassName={(record: VarianceTableRow) => {
          if (record.level === 'group') return 'variance-group-row'
          if (record.level === 'parent') return 'variance-parent-row'
          return 'variance-leaf-row'
        }}
        style={{ borderRadius: 6, overflow: 'hidden' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row
              style={{ fontWeight: 700, background: COLORS.creamDark }}
            >
              <Table.Summary.Cell index={0}>
                <Text strong>Totals</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text style={{ fontFamily: MONEY_FONT, fontWeight: 700 }}>
                  {formatCurrency(totalInitial)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text style={{ fontFamily: MONEY_FONT, color: '#aaa' }}>
                  {formatCurrency(totalTransfers)}
                </Text>
              </Table.Summary.Cell>
              {hasExpected && (
                <Table.Summary.Cell index={3} align="right">
                  <Text style={{ fontFamily: MONEY_FONT, color: COLORS.copper, fontWeight: 700 }}>
                    {formatCurrency(totalExpected)}
                  </Text>
                </Table.Summary.Cell>
              )}
              <Table.Summary.Cell index={hasExpected ? 4 : 3} align="right">
                <Text style={{ fontFamily: MONEY_FONT, color: COLORS.terracotta, fontWeight: 700 }}>
                  {formatCurrency(totalSpent)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={hasExpected ? 5 : 4} align="right">
                <Text
                  style={{
                    fontFamily: MONEY_FONT,
                    color: effectiveTotalRemaining >= 0 ? COLORS.sage : COLORS.terracotta,
                    fontWeight: 700,
                  }}
                >
                  {formatCurrency(effectiveTotalRemaining)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={hasExpected ? 6 : 5} />
              {hasMembers && <Table.Summary.Cell index={summaryCols - 1} />}
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  )
}

export default VarianceTable
