'use client'

import { useMemo, useEffect } from 'react'
import { DatePicker, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd'
import Link from 'next/link'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { BudgetPeriod, BudgetSubPeriod, PaySchedule } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils/money'
import { COLORS } from '@/theme'

const { Text } = Typography
const { RangePicker } = DatePicker

// ─── Types ──────────────────────────────────────────────────────────────────

export type PeriodSelectorMode = 'budget' | 'pay' | 'custom'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCurrentSubPeriod(sp: BudgetSubPeriod): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return sp.start_date <= today && today <= sp.end_date
}

function formatSubPeriodLabel(sp: BudgetSubPeriod): React.ReactNode {
  const startFmt = dayjs(sp.start_date).format('MMM D')
  const endFmt = dayjs(sp.end_date).format('MMM D, YYYY')
  const carry = sp.surplus_carry_forward_cents

  let carryStr = ''
  if (carry !== 0) {
    const sign = carry > 0 ? '+' : ''
    carryStr = ` (${sign}${formatCurrency(carry)} carry)`
  }

  const isCurrent = isCurrentSubPeriod(sp)
  const isCarryOnly = sp.is_carry_only === 1

  return (
    <span>
      {startFmt} - {endFmt}
      {carryStr}
      {isCarryOnly && (
        <Tag color="default" style={{ fontSize: 10, marginLeft: 4, lineHeight: '16px', padding: '0 4px' }}>
          Carry-Forward Only
        </Tag>
      )}
      {isCurrent && (
        <Text style={{ marginLeft: 8, fontSize: 11, color: COLORS.terracotta }}>
          (current)
        </Text>
      )}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value: number | null
  onChange: (id: number | null) => void
  periods: BudgetPeriod[]
  allowClear?: boolean
  disabled?: boolean
  loading?: boolean
  style?: React.CSSProperties
  // Multi-mode props (optional -- omit for budget-only usage like BudgetPage)
  mode?: PeriodSelectorMode
  onModeChange?: (mode: PeriodSelectorMode) => void
  schedules?: PaySchedule[]
  dateRange?: [string, string] | null
  onDateRangeChange?: (range: [string, string] | null) => void
  selectedMonth?: string | null // "YYYY-MM" for budget mode
  onMonthChange?: (month: string | null) => void
}

const MODE_LABELS: Record<PeriodSelectorMode, string> = {
  budget: 'Budget',
  pay: 'Pay',
  custom: 'All',
}

export function PeriodSelector({
  value,
  onChange,
  periods,
  allowClear = false,
  disabled,
  loading,
  style,
  mode,
  onModeChange,
  schedules,
  dateRange,
  onDateRangeChange,
  selectedMonth,
  onMonthChange,
}: PeriodSelectorProps): React.JSX.Element {
  const isMultiMode = mode !== undefined

  // Budget month options (string values — calendar months for multi-mode budget selector)
  const budgetMonthOptions = useMemo(() => {
    const allSubPeriods = periods.flatMap((p) => p.sub_periods ?? [])
    if (allSubPeriods.length === 0) return []

    const dates = allSubPeriods.flatMap((sp) => [sp.start_date, sp.end_date])
    const earliest = dayjs(dates.sort()[0]).startOf('month')
    const currentMonth = dayjs().startOf('month')

    const months: { value: string; label: React.ReactNode; searchText: string }[] = []
    let cursor = earliest
    while (cursor.isBefore(currentMonth) || cursor.isSame(currentMonth, 'month')) {
      const monthKey = cursor.format('YYYY-MM')
      const isCurrent = dayjs().format('YYYY-MM') === monthKey
      months.push({
        value: monthKey,
        label: (
          <span>
            {cursor.format('MMMM YYYY')}
            {isCurrent && (
              <Text style={{ marginLeft: 8, fontSize: 11, color: COLORS.terracotta }}>
                (current)
              </Text>
            )}
          </span>
        ),
        searchText: cursor.format('MMMM YYYY'),
      })
      cursor = cursor.add(1, 'month')
    }

    const byYear = new Map<number, typeof months>()
    for (const m of months) {
      const year = parseInt(m.value.slice(0, 4))
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(m)
    }

    return [...byYear.keys()].sort((a, b) => b - a).map((year) => ({
      label: String(year),
      options: byYear.get(year)!,
    }))
  }, [periods])

  // Budget period options (number values — sub-period IDs for single-mode BudgetPage)
  const budgetPeriodOptions = useMemo(() => {
    const allSubPeriods = periods.flatMap((p) => p.sub_periods ?? [])
    if (allSubPeriods.length === 0) return []

    const byYear = new Map<number, BudgetSubPeriod[]>()
    for (const sp of allSubPeriods) {
      const year = dayjs(sp.start_date).year()
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(sp)
    }

    const sortedYears = [...byYear.keys()].sort((a, b) => b - a)

    return sortedYears.map((year) => {
      const subPeriods = byYear.get(year)!.sort((a, b) =>
        a.start_date.localeCompare(b.start_date),
      )
      return {
        label: String(year),
        options: subPeriods.map((sp) => ({
          value: sp.id,
          label: formatSubPeriodLabel(sp),
          searchText: `${dayjs(sp.start_date).format('MMM D')} - ${dayjs(sp.end_date).format('MMM D, YYYY')}`,
        })),
      }
    })
  }, [periods])

  // Build pay-mode options: sub-periods grouped by pay schedule name (current and past only)
  const payOptions = useMemo(() => {
    if (!schedules || schedules.length === 0) return budgetPeriodOptions

    const today = new Date().toISOString().slice(0, 10)
    const allSubPeriods = periods.flatMap((p) => {
      const scheduleName = schedules.find((s) => s.id === p.pay_schedule_id)?.name
      return (p.sub_periods ?? [])
        .filter((sp) => sp.start_date <= today) // exclude future periods
        .map((sp) => ({ ...sp, scheduleName: scheduleName ?? 'Unknown Schedule', scheduleId: p.pay_schedule_id }))
    })

    if (allSubPeriods.length === 0) return []

    const bySchedule = new Map<string, typeof allSubPeriods>()
    for (const sp of allSubPeriods) {
      if (!bySchedule.has(sp.scheduleName)) bySchedule.set(sp.scheduleName, [])
      bySchedule.get(sp.scheduleName)!.push(sp)
    }

    return [...bySchedule.entries()].map(([scheduleName, sps]) => {
      const sorted = sps.sort((a, b) => a.start_date.localeCompare(b.start_date))
      return {
        label: scheduleName,
        options: sorted.map((sp) => ({
          value: sp.id,
          label: formatSubPeriodLabel(sp),
          searchText: `${dayjs(sp.start_date).format('MMM D')} - ${dayjs(sp.end_date).format('MMM D, YYYY')}`,
        })),
      }
    })
  }, [periods, schedules, budgetPeriodOptions])

  // Auto-select current period on mount / when periods load (pay mode and single-mode only)
  useEffect(() => {
    if (isMultiMode && (mode === 'custom' || mode === 'budget')) return
    if (value != null) return

    const allSubPeriods = periods.flatMap((p) => p.sub_periods ?? [])
    if (allSubPeriods.length === 0) return

    const current = allSubPeriods.find(isCurrentSubPeriod)
    const selected = current ?? allSubPeriods[0]
    if (selected) {
      onChange(selected.id)
    }
  // Run when periods data changes (new periods loaded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.length, mode])

  // No periods: show a link to settings
  const allSubPeriods = periods.flatMap((p) => p.sub_periods ?? [])
  if (!loading && allSubPeriods.length === 0) {
    return (
      <Text type="secondary">
        No pay schedule configured.{' '}
        <Link href="/settings/pay-schedule">Set up a pay schedule</Link>
        {' '}to create budget periods.
      </Text>
    )
  }

  // Handle DatePicker.RangePicker change
  const handleRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null,
  ): void => {
    if (!dates) {
      onDateRangeChange?.(null)
    } else if (dates[0] && dates[1]) {
      onDateRangeChange?.([
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD'),
      ])
    }
  }

  const rangePickerValue: [Dayjs, Dayjs] | null = dateRange
    ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
    : null

  // Budget month Select element
  const budgetMonthSelect = (
    <Select
      style={style ?? { minWidth: 200 }}
      value={selectedMonth ?? undefined}
      onChange={(val: string | undefined) => {
        const month = val ?? null
        onMonthChange?.(month)
        if (month) {
          const start = dayjs(month + '-01')
          onDateRangeChange?.([
            start.format('YYYY-MM-DD'),
            start.endOf('month').format('YYYY-MM-DD'),
          ])
        } else {
          onDateRangeChange?.(null)
        }
      }}
      loading={loading}
      disabled={disabled}
      placeholder="Select a month"
      options={budgetMonthOptions}
      showSearch
      allowClear
      onClear={() => {
        onMonthChange?.(null)
        onDateRangeChange?.(null)
      }}
      popupMatchSelectWidth={false}
      filterOption={(input, option) => {
        if (!option) return false
        const text = (option as { searchText?: string }).searchText ?? String(option.label ?? '')
        return text.toLowerCase().includes(input.toLowerCase())
      }}
      optionRender={(option) => (
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {option.label}
        </div>
      )}
    />
  )

  // Pay-period Select element (sub-period IDs)
  const paySelectElement = (
    <Select
      style={style ?? { minWidth: 280 }}
      value={value ?? undefined}
      onChange={(val: number | undefined) => onChange(val ?? null)}
      loading={loading}
      disabled={disabled}
      placeholder="Select a pay period"
      options={payOptions}
      showSearch
      allowClear={allowClear}
      onClear={() => onChange(null)}
      popupMatchSelectWidth={false}
      filterOption={(input, option) => {
        if (!option) return false
        const text = (option as { searchText?: string }).searchText ?? String(option.label ?? '')
        return text.toLowerCase().includes(input.toLowerCase())
      }}
      optionRender={(option) => (
        <Tooltip title={(option.data as { searchText?: string }).searchText} placement="right" mouseEnterDelay={0.5}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {option.label}
          </div>
        </Tooltip>
      )}
      labelRender={(props) => {
        const allOpts = payOptions.flatMap((g) => g.options)
        const match = allOpts.find((o) => o.value === props.value)
        return (
          <Tooltip title={match?.searchText} placement="bottom" mouseEnterDelay={0.8}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {props.label}
            </span>
          </Tooltip>
        )
      }}
    />
  )

  // Single-mode Select element (BudgetPage: sub-period IDs, original behavior)
  const singleModeSelect = (
    <Select
      style={style ?? { minWidth: 280 }}
      value={value ?? undefined}
      onChange={(val: number | undefined) => onChange(val ?? null)}
      loading={loading}
      disabled={disabled}
      placeholder="Select a budget period"
      options={budgetPeriodOptions}
      showSearch
      allowClear={allowClear}
      onClear={() => onChange(null)}
      popupMatchSelectWidth={false}
      filterOption={(input, option) => {
        if (!option) return false
        const text = (option as { searchText?: string }).searchText ?? String(option.label ?? '')
        return text.toLowerCase().includes(input.toLowerCase())
      }}
      optionRender={(option) => (
        <Tooltip title={(option.data as { searchText?: string }).searchText} placement="right" mouseEnterDelay={0.5}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {option.label}
          </div>
        </Tooltip>
      )}
      labelRender={(props) => {
        const allOpts = budgetPeriodOptions.flatMap((g) => g.options)
        const match = allOpts.find((o) => o.value === props.value)
        return (
          <Tooltip title={match?.searchText} placement="bottom" mouseEnterDelay={0.8}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {props.label}
            </span>
          </Tooltip>
        )
      }}
    />
  )

  // Non-multi-mode: render exactly as before (budget-only, no Segmented)
  if (!isMultiMode) {
    return singleModeSelect
  }

  // Multi-mode: Segmented + mode-specific selector
  const modeSelector = (() => {
    switch (mode) {
      case 'budget':
        return budgetMonthSelect
      case 'pay':
        return paySelectElement
      case 'custom':
        return (
          <Space size={8} align="center">
            <RangePicker
              size="small"
              value={rangePickerValue}
              onChange={handleRangeChange}
              format="MMM D, YYYY"
              allowClear
              style={{ minWidth: 240 }}
            />
            {!dateRange && (
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                All transactions to date
              </Text>
            )}
          </Space>
        )
      default:
        return null
    }
  })()

  return (
    <Space size={8} align="center">
      <Segmented
        size="small"
        value={mode}
        onChange={(val) => onModeChange?.(val as PeriodSelectorMode)}
        options={[
          { label: MODE_LABELS.budget, value: 'budget' },
          { label: MODE_LABELS.pay, value: 'pay' },
          { label: MODE_LABELS.custom, value: 'custom' },
        ]}
      />
      {modeSelector}
    </Space>
  )
}

export default PeriodSelector
