'use client'

import { useMemo } from 'react'
import { Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import type { PaySchedule } from '@/lib/api/types'
import { COLORS } from '@/theme'

const { Text } = Typography

interface PeriodTimelinePreviewProps {
  schedule: PaySchedule
  monthsAhead: number
}

function computePreviewPeriods(schedule: PaySchedule, monthsAhead: number): { start: string; end: string }[] {
  const results: { start: string; end: string }[] = []
  const now = dayjs()

  if (schedule.schedule_type === 'semimonthly') {
    const d1 = schedule.day_of_month_1 ?? 1
    const d2 = schedule.day_of_month_2 ?? 15
    const [first, second] = d1 < d2 ? [d1, d2] : [d2, d1]

    for (let m = 0; m <= monthsAhead; m++) {
      const month = now.add(m, 'month')
      const daysInMonth = month.daysInMonth()
      const actualFirst = Math.min(first, daysInMonth)
      const actualSecond = Math.min(second, daysInMonth)
      results.push({
        start: month.date(actualFirst).format('YYYY-MM-DD'),
        end: month.date(actualSecond).subtract(1, 'day').format('YYYY-MM-DD'),
      })
      results.push({
        start: month.date(actualSecond).format('YYYY-MM-DD'),
        end: month.add(1, 'month').date(Math.min(first, month.add(1, 'month').daysInMonth())).subtract(1, 'day').format('YYYY-MM-DD'),
      })
    }
  } else if (schedule.schedule_type === 'monthly') {
    const day = schedule.day_of_month_1 ?? 1
    for (let m = 0; m <= monthsAhead; m++) {
      const month = now.add(m, 'month')
      const daysInMonth = month.daysInMonth()
      const actualDay = Math.min(day, daysInMonth)
      const start = month.date(actualDay)
      const nextMonth = month.add(1, 'month')
      const end = nextMonth.date(Math.min(day, nextMonth.daysInMonth())).subtract(1, 'day')
      results.push({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') })
    }
  } else if (schedule.schedule_type === 'biweekly' || schedule.schedule_type === 'weekly') {
    const weeks = schedule.schedule_type === 'biweekly' ? 2 : 1
    const anchor = schedule.anchor_date ? dayjs(schedule.anchor_date) : now
    let cursor = anchor
    while (cursor.isBefore(now)) cursor = cursor.add(weeks, 'week')
    cursor = cursor.subtract(weeks, 'week')

    const endDate = now.add(monthsAhead, 'month')
    while (cursor.isBefore(endDate)) {
      const next = cursor.add(weeks, 'week')
      results.push({ start: cursor.format('YYYY-MM-DD'), end: next.subtract(1, 'day').format('YYYY-MM-DD') })
      cursor = next
    }
  }

  // Filter to show only periods starting after last month
  const cutoff = now.subtract(1, 'month').format('YYYY-MM-DD')
  return results.filter((p) => p.end >= cutoff).slice(0, 12)
}

export function PeriodTimelinePreview({ schedule, monthsAhead }: PeriodTimelinePreviewProps): React.JSX.Element {
  const today = dayjs().format('YYYY-MM-DD')
  const periods = useMemo(() => computePreviewPeriods(schedule, monthsAhead), [schedule, monthsAhead])

  if (periods.length === 0) {
    return <Text type="secondary">No preview periods.</Text>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {periods.map((p, idx) => {
        const isCurrent = p.start <= today && today <= p.end
        return (
          <Tag
            key={idx}
            color={isCurrent ? 'blue' : 'default'}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            {dayjs(p.start).format('MMM D')} — {dayjs(p.end).format('MMM D')}
          </Tag>
        )
      })}
    </div>
  )
}

export default PeriodTimelinePreview
