'use client'

import { Tag } from 'antd'
import { LockOutlined } from '@ant-design/icons'

interface PeriodStatusBadgeProps {
  closedAt: string | null
  lockedAt: string | null
  /** Show "Rolled Over" style for carry-forward periods */
  isCarryForward?: boolean
}

/**
 * Compact badge showing the current period lifecycle status.
 * Uses UX-05 approachable language:
 * - Open → green "Open"
 * - Closed → blue "Finalized"
 * - Locked → default "Frozen" with lock icon
 * - Carry-Forward → purple "Rolled Over"
 */
export function PeriodStatusBadge({
  closedAt,
  lockedAt,
  isCarryForward,
}: PeriodStatusBadgeProps): React.JSX.Element {
  if (isCarryForward) {
    return <Tag color="purple">Rolled Over</Tag>
  }

  if (lockedAt) {
    return (
      <Tag icon={<LockOutlined />} color="default">
        Frozen
      </Tag>
    )
  }

  if (closedAt) {
    return <Tag color="blue">Finalized</Tag>
  }

  return <Tag color="green">Open</Tag>
}

export default PeriodStatusBadge
