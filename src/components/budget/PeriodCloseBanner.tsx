'use client'

import { useState } from 'react'
import { Alert, Button } from 'antd'
import { useRouter } from 'next/navigation'
import { useBudgetPeriodsStatus } from '@/lib/api/budget'
import { useSetting } from '@/lib/api/settings'

/**
 * Dismissible banner shown in AppShell when periods need action.
 * Shows at most one banner — finalize reminder takes priority over freeze reminder.
 * Dismissal is session-local (not persisted); reappears on next app open.
 *
 * Uses UX-05 approachable language:
 * - "Close" → "Finalize"
 * - "Lock" → "Freeze"
 */
export function PeriodCloseBanner(): React.JSX.Element | null {
  const router = useRouter()
  const { data: periodsStatus } = useBudgetPeriodsStatus()
  const { data: closeReminders } = useSetting('periodCloseReminders')
  const { data: lockReminders } = useSetting('periodLockReminders')

  const [closeBannerDismissed, setCloseBannerDismissed] = useState(false)
  const [lockBannerDismissed, setLockBannerDismissed] = useState(false)

  const periods = periodsStatus?.data ?? []

  // Default to true if setting not yet loaded
  const periodCloseReminders = closeReminders?.value !== 'false'
  const periodLockReminders = lockReminders?.value !== 'false'

  // Periods that need finalizing (end date past, not yet closed)
  const periodsNeedingClose = periods.filter((p) => p.needs_close)

  // Periods that were finalized 3+ days ago but not yet frozen
  const today = new Date()
  const periodsNeedingLock = periods.filter((p) => {
    if (!p.closed_at || p.locked_at) return false
    const closedDate = new Date(p.closed_at)
    const daysSinceClosed = (today.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceClosed >= 3
  })

  // Format a date range label for a period
  function formatRange(p: { start_date: string; end_date: string }): string {
    const fmt = (d: string): string => {
      const date = new Date(d + 'T00:00:00')
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return `${fmt(p.start_date)} – ${fmt(p.end_date)}`
  }

  // UX-05: Finalize reminder takes priority (was "Close")
  if (
    periodCloseReminders &&
    periodsNeedingClose.length > 0 &&
    !closeBannerDismissed
  ) {
    const periodList = periodsNeedingClose.map((p) => formatRange(p)).join(', ')
    return (
      <Alert
        type="warning"
        showIcon
        closable
        onClose={() => setCloseBannerDismissed(true)}
        message="You have budget periods ready to finalize"
        description={`Periods needing finalization: ${periodList}`}
        action={
          <Button
            size="small"
            type="link"
            onClick={() => router.push('/budget')}
          >
            Review
          </Button>
        }
        style={{ marginBottom: 0 }}
      />
    )
  }

  // UX-05: Freeze reminder (was "Lock")
  if (
    periodLockReminders &&
    periodsNeedingLock.length > 0 &&
    !lockBannerDismissed
  ) {
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={() => setLockBannerDismissed(true)}
        message="You have finalized periods that haven't been frozen yet"
        action={
          <Button
            size="small"
            type="link"
            onClick={() => router.push('/budget')}
          >
            Review
          </Button>
        }
        style={{ marginBottom: 0 }}
      />
    )
  }

  return null
}

export default PeriodCloseBanner
