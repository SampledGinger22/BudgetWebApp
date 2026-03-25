'use client'

import { CheckCircleOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Space, Typography } from 'antd'
import { COLORS } from '@/theme'

const { Text } = Typography

interface ReconciliationFooterProps {
  canFinish: boolean
  clearedCount: number
  onFinish: () => void
  onCancel: () => void
  loading: boolean
}

/**
 * Footer bar with Finish/Cancel buttons for the reconciliation flow.
 */
export function ReconciliationFooter({
  canFinish,
  clearedCount,
  onFinish,
  onCancel,
  loading,
}: ReconciliationFooterProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        marginTop: 16,
        borderTop: `1px solid rgba(92, 61, 30, 0.15)`,
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 13, color: COLORS.walnut }}>
        {clearedCount} transaction{clearedCount !== 1 ? 's' : ''} cleared
      </Text>

      <Space>
        <Popconfirm
          title="Cancel reconciliation?"
          description="Your checked transactions will be discarded. This cannot be undone."
          onConfirm={onCancel}
          okText="Discard"
          cancelText="Keep Working"
          okButtonProps={{ danger: true }}
        >
          <Button>Cancel Reconciliation</Button>
        </Popconfirm>

        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={!canFinish}
          loading={loading}
          onClick={onFinish}
          style={canFinish ? { background: COLORS.sage, borderColor: COLORS.sage } : {}}
        >
          Finish Reconciliation
        </Button>
      </Space>
    </div>
  )
}
