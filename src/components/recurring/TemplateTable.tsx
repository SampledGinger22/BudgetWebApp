'use client'

import { useState } from 'react'
import { Button, Checkbox, Dropdown, Space, Table, Tag, Typography } from 'antd'
import {
  CaretDownOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { RecurringTemplate } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

type RecurringType = 'bill' | 'income' | 'subscription' | 'credit_payment' | 'transfer' | 'investment'

interface TemplateTableProps {
  type: RecurringType
  typeLabel: string
  templates: (RecurringTemplate & { _expiringSoon?: boolean })[]
  collapsed: boolean
  onToggleCollapse: () => void
  onEdit: (template: RecurringTemplate) => void
  onDelete: (templateId: number) => void
  onToggleStatus: (templateId: number) => void
  selectedIds: Set<number>
  onSelectChange: (id: number, checked: boolean) => void
}

const { Text } = Typography

function formatDayOrdinal(day: number): string {
  if (day === 32) return 'last day of month'
  const suffix = ['th', 'st', 'nd', 'rd']
  const v = day % 100
  return day + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0])
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatSchedule(template: RecurringTemplate): string {
  const { frequency, interval_n, template_dates } = template
  const dayValues = template_dates.map((d) => d.day_value).sort((a, b) => a - b)

  if (frequency === 'weekly') {
    const dayNames = dayValues.map((d) => WEEKDAY_NAMES[d] ?? `Day ${d}`)
    const daysStr = dayNames.join(' & ')
    if (interval_n === 1) return `Weekly on ${daysStr}`
    return `Every ${interval_n} weeks on ${daysStr}`
  }

  const daysStr = dayValues.map(formatDayOrdinal).join(' & ')
  if (interval_n === 1) return `Monthly on the ${daysStr}`
  return `Every ${interval_n} months on the ${daysStr}`
}

function StatusBadge({ status }: { status: RecurringTemplate['status'] }): React.JSX.Element {
  if (status === 'active') return <Tag color="success">Active</Tag>
  if (status === 'paused') return <Tag color="warning">Paused</Tag>
  return <Tag color="default">Completed</Tag>
}

export function TemplateTable({
  typeLabel,
  templates,
  collapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
  onToggleStatus,
  selectedIds,
  onSelectChange,
}: TemplateTableProps): React.JSX.Element {
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null)

  const sortedTemplates = [...templates].sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, paused: 1, completed: 2 }
    const sDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2)
    if (sDiff !== 0) return sDiff
    if (!a.next_date && !b.next_date) return 0
    if (!a.next_date) return 1
    if (!b.next_date) return -1
    return a.next_date.localeCompare(b.next_date)
  })

  const contextMenuItems = (template: RecurringTemplate) => [
    { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: () => onEdit(template) },
    {
      key: 'toggle',
      label: template.status === 'active' ? 'Pause' : 'Activate',
      icon: template.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      onClick: () => onToggleStatus(template.id),
    },
    { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true, onClick: () => onDelete(template.id) },
  ]

  const columns: ColumnType<RecurringTemplate & { _expiringSoon?: boolean }>[] = [
    {
      key: 'checkbox',
      width: 40,
      render: (_: unknown, record) => (
        <Checkbox
          checked={selectedIds.has(record.id)}
          onChange={(e) => onSelectChange(record.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      title: 'Description',
      key: 'name',
      render: (_: unknown, record) => (
        <Text strong style={{ color: COLORS.walnut }}>{record.name}</Text>
      ),
    },
    {
      title: 'Vendor / Payee',
      key: 'vendor',
      responsive: ['lg' as const],
      render: (_: unknown, record) => (
        <Text type="secondary">{record.vendor_name ?? '—'}</Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, record) => (
        <Text
          style={{
            fontFamily: MONEY_FONT,
            color: record.is_debit === 1 ? COLORS.terracotta : COLORS.sage,
            fontWeight: 600,
          }}
        >
          {record.is_debit === 1 ? '-' : '+'}{formatCurrency(record.amount_cents)}
        </Text>
      ),
    },
    {
      title: 'Schedule',
      key: 'schedule',
      render: (_: unknown, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{formatSchedule(record)}</Text>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      responsive: ['xl' as const],
      render: (_: unknown, record) => (
        <Text type="secondary">{record.category_name ?? '—'}</Text>
      ),
    },
    {
      title: 'Account',
      key: 'account',
      responsive: ['xl' as const],
      render: (_: unknown, record) => (
        <Text type="secondary">{record.account_name ?? '—'}</Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record) => (
        <Space size={4}>
          <StatusBadge status={record.status} />
          {record._expiringSoon && <Tag color="orange" style={{ fontSize: 11 }}>Expiring soon</Tag>}
        </Space>
      ),
    },
    {
      title: 'Next Date',
      key: 'next_date',
      responsive: ['lg' as const],
      render: (_: unknown, record) => {
        if (record.status !== 'active' || !record.next_date) return <Text type="secondary">N/A</Text>
        return <Text style={{ color: COLORS.walnut }}>{dayjs(record.next_date).format('MMM D, YYYY')}</Text>
      },
    },
    {
      key: 'actions',
      width: 100,
      render: (_: unknown, record) => (
        <div style={{ opacity: hoveredRowId === record.id ? 1 : 0, transition: 'opacity 0.15s', display: 'flex', gap: 2 }}>
          <Button type="text" size="small" icon={<EditOutlined />} title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(record) }} />
          <Button
            type="text"
            size="small"
            icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            title={record.status === 'active' ? 'Pause' : 'Activate'}
            onClick={(e) => { e.stopPropagation(); onToggleStatus(record.id) }}
          />
          <Button type="text" size="small" icon={<DeleteOutlined />} title="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(record.id) }} />
        </div>
      ),
    },
  ]

  return (
    <div>
      <div
        onClick={onToggleCollapse}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          backgroundColor: COLORS.creamDark, borderRadius: 6, cursor: 'pointer',
          marginBottom: collapsed ? 0 : 8, userSelect: 'none',
          border: `1px solid rgba(92, 61, 30, 0.1)`,
        }}
      >
        {collapsed ? (
          <CaretRightOutlined style={{ color: COLORS.walnut, fontSize: 12 }} />
        ) : (
          <CaretDownOutlined style={{ color: COLORS.walnut, fontSize: 12 }} />
        )}
        <Text strong style={{ color: COLORS.walnut, fontSize: 14 }}>{typeLabel}</Text>
        <Tag style={{ fontSize: 11, padding: '0 6px', backgroundColor: 'rgba(92, 61, 30, 0.08)', border: 'none', color: COLORS.walnut }}>
          {templates.length}
        </Tag>
      </div>
      {!collapsed && (
        <Table<RecurringTemplate & { _expiringSoon?: boolean }>
          className="recurring-table"
          dataSource={sortedTemplates}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          style={{ marginBottom: 8 }}
          rowClassName={(record) => record.status !== 'active' ? 'recurring-row-inactive' : ''}
          onRow={(record) => ({
            onMouseEnter: () => setHoveredRowId(record.id),
            onMouseLeave: () => setHoveredRowId(null),
            style: { opacity: record.status !== 'active' ? 0.5 : 1 },
          })}
          components={{
            body: {
              row: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string }) => {
                const rowKey = props['data-row-key']
                const record = sortedTemplates.find((t) => String(t.id) === rowKey)
                if (!record) return <tr {...props}>{children}</tr>
                return (
                  <Dropdown menu={{ items: contextMenuItems(record) }} trigger={['contextMenu']}>
                    <tr {...props}>{children}</tr>
                  </Dropdown>
                )
              },
            },
          }}
        />
      )}
    </div>
  )
}

export default TemplateTable
