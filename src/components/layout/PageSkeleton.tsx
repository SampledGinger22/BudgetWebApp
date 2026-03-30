'use client'

import { Skeleton, Space } from 'antd'

interface PageSkeletonProps {
  /** Number of card-like skeleton blocks to show */
  cards?: number
  /** Show a header-sized skeleton paragraph at top */
  header?: boolean
}

/**
 * Lightweight skeleton placeholder shown while page content loads.
 * Used by loading.tsx files to give instant visual feedback.
 */
export function PageSkeleton({ cards = 2, header = true }: PageSkeletonProps) {
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      {header && (
        <Skeleton
          active
          title={{ width: 200 }}
          paragraph={false}
        />
      )}
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} active paragraph={{ rows: 3 }} />
      ))}
    </Space>
  )
}
