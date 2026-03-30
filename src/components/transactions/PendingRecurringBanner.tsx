'use client'

import { Alert, Button, Tag, Typography, message } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useState } from 'react'
import { usePendingEntries, useConfirmEntry } from '@/lib/api/recurring'
import { useBudgetPeriodsStatus } from '@/lib/api/budget'
import type { PendingRecurringEntry } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS, MONEY_FONT } from '@/theme'

const { Text } = Typography

interface PendingRecurringBannerProps {
  accountId: number
  dateRange?: [string, string] | null
}

/**
 * Banner showing unconfirmed pending recurring entries for the selected account.
 * Uses S06 usePendingEntries hook; individual creates are handled via confirm.
 */
export function PendingRecurringBanner({
  accountId,
  dateRange,
}: PendingRecurringBannerProps): React.JSX.Element | null {
  const { data: pendingResponse } = usePendingEntries(accountId)
  const { data: periodsStatusResp } = useBudgetPeriodsStatus()
  const periodsStatus = periodsStatusResp?.data ?? []
  const confirmEntry = useConfirmEntry()
  const [expanded, setExpanded] = useState(false)
  const [creatingSet, setCreatingSet] = useState<Set<string>>(new Set())

  const allEntries = pendingResponse?.data ?? []

  // Filter to entries within the active date range
  const entries = allEntries.filter((e) => {
    if (!dateRange) return true
    const [from, to] = dateRange
    return e.date >= from && e.date <= to
  })

  if (entries.length === 0) return null

  const displayEntries = expanded ? entries : entries.slice(0, 3)
  const hiddenCount = entries.length - 3

  const handleCreate = async (entry: PendingRecurringEntry): Promise<void> => {
    const key = `${entry.template_id}:${entry.date}`
    setCreatingSet((prev) => new Set(prev).add(key))

    try {
      // Find the sub-period that covers this date
      const matchingPeriod = periodsStatus.find(
        (sp) => sp.start_date <= entry.date && sp.end_date >= entry.date,
      )

      if (!matchingPeriod) {
        void message.warning('No budget period covers this date. Create a budget period first.')
        return
      }

      await confirmEntry.mutateAsync({
        transactionId: entry.template_id,
        actualAmountCents: entry.amount_cents,
      })

      void message.success(`Created: ${entry.template_name}`)
    } catch {
      void message.error('Failed to create transaction')
    } finally {
      setCreatingSet((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const statusTag = (entry: PendingRecurringEntry): React.JSX.Element => {
    if (entry.status === 'past_due') {
      return <Tag color="error" style={{ margin: 0 }}>Past Due</Tag>
    }
    if (entry.status === 'due_today') {
      return <Tag color="warning" style={{ margin: 0 }}>Due Today</Tag>
    }
    return <Tag color="processing" style={{ margin: 0 }}>Upcoming</Tag>
  }

  const borderColor = (entry: PendingRecurringEntry): string => {
    if (entry.status === 'past_due') return COLORS.terracotta
    if (entry.status === 'due_today') return COLORS.copper
    return COLORS.sage
  }

  const pastDueCount = entries.filter((e) => e.status === 'past_due').length
  const dueTodayCount = entries.filter((e) => e.status === 'due_today').length

  let alertMessage = `${entries.length} pending recurring transaction${entries.length !== 1 ? 's' : ''}`
  if (pastDueCount > 0) {
    alertMessage += ` (${pastDueCount} past due)`
  } else if (dueTodayCount > 0) {
    alertMessage += ` (${dueTodayCount} due today)`
  }

  return (
    <Alert
      type="info"
      showIcon
      icon={<ClockCircleOutlined />}
      title={alertMessage}
      description={
        <div style={{ marginTop: 8 }}>
          {displayEntries.map((entry) => {
            const key = `${entry.template_id}:${entry.date}`
            const isCreating = creatingSet.has(key)

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 8px',
                  borderLeft: `3px solid ${borderColor(entry)}`,
                  marginBottom: 4,
                  borderRadius: '0 4px 4px 0',
                  background: 'rgba(255,255,255,0.4)',
                }}
              >
                {statusTag(entry)}

                <Text
                  style={{ flex: 1, minWidth: 0 }}
                  ellipsis={{ tooltip: entry.template_name }}
                >
                  {entry.template_name}
                </Text>

                <Text
                  style={{
                    fontFamily: MONEY_FONT,
                    color: entry.is_debit ? COLORS.terracotta : COLORS.sage,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.is_debit ? '-' : '+'}{formatCurrency(entry.amount_cents)}
                </Text>

                <Text type="secondary" style={{ whiteSpace: 'nowrap', minWidth: 60 }}>
                  {entry.category ?? '\u2014'}
                </Text>

                <Text type="secondary" style={{ whiteSpace: 'nowrap', minWidth: 50 }}>
                  {dayjs(entry.date).format('MMM D')}
                </Text>

                <Button
                  size="small"
                  type="primary"
                  loading={isCreating}
                  onClick={() => void handleCreate(entry)}
                  style={{ background: COLORS.sage, borderColor: COLORS.sage }}
                >
                  Create Now
                </Button>
              </div>
            )
          })}

          {hiddenCount > 0 && !expanded && (
            <a
              style={{ color: COLORS.terracotta, cursor: 'pointer', fontSize: 13, marginTop: 4, display: 'inline-block' }}
              onClick={() => setExpanded(true)}
            >
              Show {hiddenCount} more...
            </a>
          )}

          {expanded && entries.length > 3 && (
            <a
              style={{ color: COLORS.terracotta, cursor: 'pointer', fontSize: 13, marginTop: 4, display: 'inline-block' }}
              onClick={() => setExpanded(false)}
            >
              Show less
            </a>
          )}
        </div>
      }
      style={{ borderRadius: 6 }}
    />
  )
}
