'use client'

import { Tooltip } from 'antd'
import { RetweetOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { COLORS } from '@/theme'

interface RecurringBadgeProps {
  templateId: number
}

/**
 * Small recurring-indicator icon shown next to transactions
 * that belong to a recurring template.
 */
export function RecurringBadge({ templateId: _templateId }: RecurringBadgeProps): React.JSX.Element {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    router.push('/recurring')
  }

  return (
    <Tooltip title="Recurring transaction — click to view template">
      <RetweetOutlined
        onClick={handleClick}
        style={{
          color: COLORS.sage,
          fontSize: 14,
          cursor: 'pointer',
          opacity: 0.8,
        }}
        aria-label="Recurring transaction"
      />
    </Tooltip>
  )
}

export default RecurringBadge
