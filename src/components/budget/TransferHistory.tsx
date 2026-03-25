'use client'

import { useState } from 'react'
import { Badge, Collapse, Popconfirm, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import type { BudgetTransfer } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text } = Typography

interface TransferHistoryProps {
  transfers: BudgetTransfer[]
  onReverse: (id: number) => Promise<void>
  isOpen: boolean
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TransferHistory({
  transfers,
  onReverse,
  isOpen,
}: TransferHistoryProps): React.JSX.Element {
  const [reversingId, setReversingId] = useState<number | null>(null)

  const handleReverse = async (id: number): Promise<void> => {
    setReversingId(id)
    try {
      await onReverse(id)
    } finally {
      setReversingId(null)
    }
  }

  const columns: TableColumnsType<BudgetTransfer> = [
    {
      title: 'Date',
      key: 'date',
      width: 100,
      render: (_: unknown, record: BudgetTransfer) => (
        <Text style={{ fontSize: 12 }}>{formatDate(record.created_at)}</Text>
      ),
    },
    {
      title: 'From',
      key: 'from',
      width: 140,
      render: (_: unknown, record: BudgetTransfer) => (
        <Text style={{ fontSize: 12 }}>{record.from_category_name}</Text>
      ),
    },
    {
      title: '',
      key: 'arrow',
      width: 30,
      render: () => (
        <Text style={{ color: COLORS.copper, fontSize: 14 }}>&rarr;</Text>
      ),
    },
    {
      title: 'To',
      key: 'to',
      width: 140,
      render: (_: unknown, record: BudgetTransfer) => (
        <Text style={{ fontSize: 12 }}>{record.to_category_name}</Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (_: unknown, record: BudgetTransfer) => (
        <span>
          <Text style={{ fontFamily: MONEY_FONT, fontSize: 12, color: COLORS.walnut }}>
            {formatCurrency(record.amount_cents)}
          </Text>
          {record.reversal_of_id !== null && (
            <Tag
              style={{
                marginLeft: 6,
                fontSize: 10,
                padding: '0 4px',
                color: COLORS.copper,
                borderColor: COLORS.copper,
                background: 'transparent',
              }}
            >
              Reversal
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Note',
      key: 'note',
      render: (_: unknown, record: BudgetTransfer) =>
        record.note ? (
          <Text style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>{record.note}</Text>
        ) : null,
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      render: (_: unknown, record: BudgetTransfer) => {
        // S06 types: has_been_reversed is boolean, is_reversal is boolean
        const isReversal = record.is_reversal
        const hasBeenReversed = record.has_been_reversed
        const canReverse = isOpen && !isReversal && !hasBeenReversed

        if (!canReverse) {
          return null
        }

        return (
          <Popconfirm
            title="Reverse this transfer?"
            onConfirm={() => handleReverse(record.id)}
            okText="Reverse"
            cancelText="Cancel"
          >
            <Typography.Link
              style={{
                fontSize: 12,
                color: COLORS.terracotta,
                opacity: reversingId === record.id ? 0.5 : 1,
              }}
            >
              Reverse
            </Typography.Link>
          </Popconfirm>
        )
      },
    },
  ]

  const collapseItems = [
    {
      key: 'history',
      label: (
        <Text style={{ fontWeight: 500, color: COLORS.walnut }}>
          Transfer History
        </Text>
      ),
      extra: (
        <Badge
          count={transfers.length}
          style={{ backgroundColor: COLORS.sage }}
        />
      ),
      children: (
        <Table<BudgetTransfer>
          dataSource={transfers}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginTop: 4 }}
        />
      ),
    },
  ]

  return (
    <Collapse
      items={collapseItems}
      defaultActiveKey={[]}
      size="small"
      style={{ marginTop: 16 }}
    />
  )
}

export default TransferHistory
