'use client'

import { CalendarOutlined } from '@ant-design/icons'
import { Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import type { RecurringTemplate } from '@/lib/api/types'
import { COLORS, MONEY_FONT } from '@/theme'
import { formatCurrency } from '@/lib/utils/money'

const { Text, Title } = Typography

// ─── Occurrence computation ───────────────────────────────────────────────────

interface ProjectedEntry {
  date: string
  templateId: number
  description: string
  amount_cents: number
  is_debit: number
  account_name: string | null
  isProjected: true
}

type TimelineEntry = ProjectedEntry

function computeProjectedDates(
  template: RecurringTemplate,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const { frequency, interval_n, template_dates, start_date, end_date, status } = template
  if (status !== 'active') return []

  const dayValues = template_dates.map((d) => d.day_value).sort((a, b) => a - b)
  if (dayValues.length === 0) return []

  const from = dayjs(rangeStart)
  const to = dayjs(rangeEnd)
  const templateStart = start_date ? dayjs(start_date) : null
  const templateEnd = end_date ? dayjs(end_date) : null

  const results: string[] = []

  if (frequency === 'monthly') {
    let currentMonth = from.startOf('month')
    for (let i = 0; i < 24 && results.length < 50; i++) {
      for (const dayVal of dayValues) {
        const daysInMonth = currentMonth.daysInMonth()
        const actualDay = dayVal === 32 ? daysInMonth : Math.min(dayVal, daysInMonth)
        const candidate = currentMonth.date(actualDay)
        const candidateStr = candidate.format('YYYY-MM-DD')
        if (
          candidate.isBefore(from, 'day') || candidate.isAfter(to, 'day') ||
          (templateStart && candidate.isBefore(templateStart, 'day')) ||
          (templateEnd && candidate.isAfter(templateEnd, 'day'))
        ) continue
        results.push(candidateStr)
      }
      currentMonth = currentMonth.add(interval_n, 'month')
      if (currentMonth.isAfter(to, 'month')) break
    }
  } else {
    let cursor = from
    for (let i = 0; i < 60 && results.length < 50; i++) {
      for (const weekday of dayValues) {
        const daysUntil = (weekday - cursor.day() + 7) % 7
        const candidate = cursor.add(daysUntil, 'day')
        const candidateStr = candidate.format('YYYY-MM-DD')
        if (
          candidate.isBefore(from, 'day') || candidate.isAfter(to, 'day') ||
          (templateStart && candidate.isBefore(templateStart, 'day')) ||
          (templateEnd && candidate.isAfter(templateEnd, 'day'))
        ) continue
        results.push(candidateStr)
      }
      cursor = cursor.add(interval_n, 'week')
      if (cursor.isAfter(to)) break
    }
  }

  return results
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UpcomingTimelineProps {
  templates: RecurringTemplate[]
  periodEnd: string
}

function EntryCard({ entry, isOverdue }: { entry: TimelineEntry; isOverdue: boolean }): React.JSX.Element {
  const isDebit = entry.is_debit === 1

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        border: `1.5px dashed rgba(92, 61, 30, 0.25)`, borderRadius: 6,
        backgroundColor: isOverdue ? 'rgba(152, 96, 40, 0.06)' : 'transparent',
        marginBottom: 4,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: COLORS.walnut, opacity: 0.7, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.description}
        </Text>
        {entry.account_name && <Text type="secondary" style={{ fontSize: 11 }}>{entry.account_name}</Text>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: MONEY_FONT, fontWeight: 600, color: isDebit ? COLORS.terracotta : COLORS.sage, opacity: 0.7 }}>
          {isDebit ? '-' : '+'}{formatCurrency(entry.amount_cents)}
        </div>
      </div>
      <Tag color="default" style={{ fontSize: 11 }}>Projected</Tag>
      {isOverdue && <Tag color="orange" style={{ fontSize: 11 }}>Overdue</Tag>}
    </div>
  )
}

const MAX_ENTRIES = 50

export function UpcomingTimeline({ templates, periodEnd }: UpcomingTimelineProps): React.JSX.Element {
  const today = dayjs().format('YYYY-MM-DD')
  const lookAhead = periodEnd || dayjs().add(30, 'day').format('YYYY-MM-DD')

  const projectedEntries: ProjectedEntry[] = []
  for (const template of templates) {
    const dates = computeProjectedDates(template, today, lookAhead)
    for (const date of dates) {
      projectedEntries.push({
        date,
        templateId: template.id,
        description: template.name,
        amount_cents: template.amount_cents,
        is_debit: template.is_debit,
        account_name: template.account_name,
        isProjected: true as const,
      })
    }
  }

  const allEntries = projectedEntries
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_ENTRIES)

  if (allEntries.length === 0) {
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CalendarOutlined style={{ color: COLORS.terracotta }} />
          <Title level={5} style={{ margin: 0, color: COLORS.walnut }}>Upcoming</Title>
        </div>
        <Text type="secondary" style={{ fontSize: 13 }}>No upcoming recurring entries for this period.</Text>
      </div>
    )
  }

  const byDate = new Map<string, TimelineEntry[]>()
  for (const entry of allEntries) {
    const existing = byDate.get(entry.date) ?? []
    existing.push(entry)
    byDate.set(entry.date, existing)
  }

  const sortedDates = [...byDate.keys()].sort()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CalendarOutlined style={{ color: COLORS.terracotta }} />
        <Title level={5} style={{ margin: 0, color: COLORS.walnut }}>Upcoming</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>Through {dayjs(lookAhead).format('MMM D, YYYY')}</Text>
      </div>
      {sortedDates.map((date) => (
        <div key={date} style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 12, color: date < today ? COLORS.copper : COLORS.walnut, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            {dayjs(date).format('MMM D, YYYY')}
          </Text>
          {(byDate.get(date) ?? []).map((entry, idx) => (
            <EntryCard key={`${entry.date}-${entry.templateId}-${idx}`} entry={entry} isOverdue={date < today} />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 24, height: 14, border: `1.5px dashed rgba(92, 61, 30, 0.25)`, borderRadius: 3 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Projected</Text>
        </div>
      </div>
    </div>
  )
}

export default UpcomingTimeline
