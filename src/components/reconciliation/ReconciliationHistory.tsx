'use client'

import { UndoOutlined } from '@ant-design/icons'
import { Button, Modal, Popconfirm, Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useReconHistory, useUndoReconSession } from '@/lib/api/reconciliation'
import type { ReconciliationSession } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS, MONEY_FONT } from '@/theme'

const { Text } = Typography

interface ReconciliationHistoryProps {
  open: boolean
  accountId: number
  onClose: () => void
  onUndoComplete: () => void
}

/**
 * Modal showing past reconciliation sessions for an account.
 * Uses S06 useReconHistory and useUndoReconSession hooks.
 */
export function ReconciliationHistory({
  open,
  accountId,
  onClose,
  onUndoComplete,
}: ReconciliationHistoryProps): React.JSX.Element {
  const { data: sessions = [], isLoading: loading } = useReconHistory(accountId)
  const undoSession = useUndoReconSession()

  // Only show completed sessions
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  const handleUndo = async (session: ReconciliationSession): Promise<void> => {
    try {
      await undoSession.mutateAsync({ id: session.id })
      void message.success('Reconciliation undone')
      onUndoComplete()
    } catch {
      void message.error('Failed to undo reconciliation session')
    }
  }

  const getTransactionCount = (session: ReconciliationSession): number => {
    if (!session.cleared_transaction_ids) return 0
    try {
      return (JSON.parse(session.cleared_transaction_ids) as number[]).length
    } catch {
      return 0
    }
  }

  const columns: ColumnsType<ReconciliationSession> = [
    {
      title: 'Statement Date',
      key: 'statement_date',
      render: (_: unknown, record: ReconciliationSession) => (
        <Text style={{ fontSize: 13 }}>
          {dayjs(record.statement_date).format('MMM D, YYYY')}
        </Text>
      ),
    },
    {
      title: 'Statement Balance',
      key: 'statement_balance',
      align: 'right',
      render: (_: unknown, record: ReconciliationSession) => (
        <Text style={{ fontSize: 13, fontFamily: MONEY_FONT }}>
          {formatCurrency(record.statement_balance_cents)}
        </Text>
      ),
    },
    {
      title: 'Transactions',
      key: 'count',
      align: 'center',
      render: (_: unknown, record: ReconciliationSession) => (
        <Text style={{ fontSize: 13 }}>
          {getTransactionCount(record)}
        </Text>
      ),
    },
    {
      title: 'Completed',
      key: 'completed_at',
      render: (_: unknown, record: ReconciliationSession) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.completed_at ? dayjs(record.completed_at).format('MMM D, YYYY') : '\u2014'}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ReconciliationSession) => (
        <Popconfirm
          title="Undo this reconciliation?"
          description={`This will un-reconcile ${getTransactionCount(record)} transaction${getTransactionCount(record) !== 1 ? 's' : ''}.`}
          onConfirm={() => handleUndo(record)}
          okText="Undo"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            size="small"
            icon={<UndoOutlined />}
            danger
          >
            Undo
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Text strong style={{ color: COLORS.walnut, fontSize: 16 }}>
          Reconciliation History
        </Text>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={650}
    >
      {completedSessions.length === 0 && !loading ? (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>
          No reconciliation history for this account.
        </Text>
      ) : (
        <Table<ReconciliationSession>
          columns={columns}
          dataSource={completedSessions}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
        />
      )}
    </Modal>
  )
}
