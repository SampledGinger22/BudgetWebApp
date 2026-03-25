/**
 * Budget engine — pure functions for recurring occurrence computation,
 * period boundary calculation, and surplus arithmetic.
 *
 * Ported from Electron IPC handlers (recurring.ts, periods.ts, budget.ts).
 * These functions have ZERO database dependency — they operate on plain
 * objects and date strings, making them testable and reusable across
 * transaction, budget, period, and recurring API routes.
 */
import dayjs from 'dayjs'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal template shape needed by occurrence computation. */
export interface RecurringTemplateInput {
  frequency: string // 'monthly' | 'weekly'
  interval_n: number
  start_date: string | null
  end_date: string | null
}

/** Minimal template-date shape needed by occurrence computation. */
export interface TemplateDateInput {
  day_value: number
}

/** Pay schedule row shape consumed by computePeriodBoundaries. */
export interface PayScheduleRow {
  id: number
  name: string
  schedule_type: 'specific_dates' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  day_of_month_1: number | null
  day_of_month_2: number | null
  day_of_week: number | null
  anchor_date: string | null
  is_primary: number
  amount_cents: number | null
  household_member_id: number | null
  income_category_id: number | null
  vendor_id: number | null
  end_date: string | null
  recurring_template_id: number | null
}

/** A single sub-period date window. */
export interface SubPeriodBoundary {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

// ─── computeOccurrences ──────────────────────────────────────────────────────

/**
 * Computes all occurrence dates for a recurring template within a date range.
 *
 * Handles:
 * - Monthly and weekly frequencies with interval_n stepping
 * - Multiple day_values per template
 * - Sentinel value 32 = last day of month
 * - Short-month fallback: day_value clamped to daysInMonth via Math.min
 * - Template start_date/end_date bounds filtering
 * - Deduplication of overlapping results (e.g., day_value=31 and 32 in Feb)
 *
 * @param template      The recurring template row (frequency, interval_n, date bounds)
 * @param templateDates Array of day_value rows for the template
 * @param rangeStart    ISO date string YYYY-MM-DD (inclusive)
 * @param rangeEnd      ISO date string YYYY-MM-DD (inclusive)
 * @returns Sorted, deduplicated array of YYYY-MM-DD date strings
 */
export function computeOccurrences(
  template: Pick<RecurringTemplateInput, 'frequency' | 'interval_n' | 'start_date' | 'end_date'>,
  templateDates: Pick<TemplateDateInput, 'day_value'>[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (templateDates.length === 0) return []

  const results: string[] = []
  const start = dayjs(rangeStart)
  const end = dayjs(rangeEnd)

  if (template.frequency === 'monthly') {
    // Iterate month by month from rangeStart to rangeEnd, stepping by interval_n
    const startYear = start.year()
    const startMonth = start.month() // 0-based

    const endYear = end.year()
    const endMonth = end.month()
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1

    for (let i = 0; i < totalMonths; i += template.interval_n) {
      const candidateMonth = dayjs(rangeStart).startOf('month').add(i, 'month')
      const daysInMonth = candidateMonth.daysInMonth()

      for (const td of templateDates) {
        // Sentinel 32 = last day of month; otherwise clamp to daysInMonth
        const dayNum = td.day_value === 32 ? daysInMonth : Math.min(td.day_value, daysInMonth)

        const dateStr = candidateMonth.date(dayNum).format('YYYY-MM-DD')
        const dateObj = dayjs(dateStr)

        // Must be within range bounds
        if (dateObj.isBefore(start) || dateObj.isAfter(end)) continue

        // Must respect template start_date bound
        if (template.start_date && dateObj.isBefore(dayjs(template.start_date))) continue

        // Must respect template end_date bound
        if (template.end_date && dateObj.isAfter(dayjs(template.end_date))) continue

        results.push(dateStr)
      }
    }
  } else if (template.frequency === 'weekly') {
    // For weekly: for each day_value (weekday: 0=Sun..6=Sat), find all occurrences
    // in the range stepping by interval_n weeks
    for (const td of templateDates) {
      const targetDayOfWeek = td.day_value // 0=Sun, 1=Mon, ..., 6=Sat

      // Find first occurrence of this weekday on or after rangeStart
      let current = start.clone()
      while (current.day() !== targetDayOfWeek) {
        current = current.add(1, 'day')
        if (current.isAfter(end)) break
      }

      if (current.isAfter(end)) continue

      // Collect all occurrences stepping by interval_n weeks
      while (!current.isAfter(end)) {
        const dateStr = current.format('YYYY-MM-DD')
        const dateObj = dayjs(dateStr)

        // Must respect template start_date bound
        if (template.start_date && dateObj.isBefore(dayjs(template.start_date))) {
          current = current.add(template.interval_n * 7, 'day')
          continue
        }

        // Must respect template end_date bound
        if (template.end_date && dateObj.isAfter(dayjs(template.end_date))) break

        results.push(dateStr)
        current = current.add(template.interval_n * 7, 'day')
      }
    }
  }

  // Deduplicate and sort
  return [...new Set(results)].sort()
}

// ─── computeNextDate ─────────────────────────────────────────────────────────

/**
 * Looks ahead up to 13 months to find the next upcoming occurrence date for a template.
 *
 * @param template      The recurring template row
 * @param templateDates Array of day_value rows for the template
 * @param fromDate      Starting date (defaults to today) as YYYY-MM-DD
 * @returns Next occurrence date as YYYY-MM-DD string, or null if none found
 */
export function computeNextDate(
  template: Pick<RecurringTemplateInput, 'frequency' | 'interval_n' | 'start_date' | 'end_date'>,
  templateDates: Pick<TemplateDateInput, 'day_value'>[],
  fromDate?: string,
): string | null {
  const from = fromDate ?? dayjs().format('YYYY-MM-DD')
  const lookaheadEnd = dayjs(from).add(13, 'month').format('YYYY-MM-DD')
  const occurrences = computeOccurrences(template, templateDates, from, lookaheadEnd)
  return occurrences[0] ?? null
}

// ─── computePeriodBoundaries ─────────────────────────────────────────────────

/**
 * Computes monthly period boundaries and their sub-period splits based on a pay schedule.
 *
 * Schedule type behavior:
 * - specific_dates: period runs day_of_month_1 → (day_of_month_1 - 1) of next month,
 *   split at day_of_month_2
 * - semimonthly: same logic as specific_dates (two pay dates per month)
 * - biweekly: anchor_date is first paycheck; sub-periods are 14-day windows within calendar month
 * - weekly: sub-periods are 7-day windows starting on day_of_week within calendar month
 * - monthly: single sub-period covering the full calendar month
 *
 * @param schedule  The pay schedule row
 * @param year      The calendar year of the monthly period start
 * @param month     The calendar month (1-based)
 * @returns Object with period start/end and array of sub-period boundaries, or null if cannot compute.
 */
export function computePeriodBoundaries(
  schedule: Pick<
    PayScheduleRow,
    'schedule_type' | 'day_of_month_1' | 'day_of_month_2' | 'day_of_week' | 'anchor_date'
  >,
  year: number,
  month: number,
): { periodStart: string; periodEnd: string; subPeriods: SubPeriodBoundary[] } | null {
  const { schedule_type, day_of_month_1, day_of_month_2, day_of_week, anchor_date } = schedule

  switch (schedule_type) {
    case 'specific_dates': {
      if (!day_of_month_1 || !day_of_month_2) return null

      const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth()
      const d1 = Math.min(day_of_month_1, daysInMonth)

      const nextMonthDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(1, 'month')
      const daysInNextMonth = nextMonthDate.daysInMonth()
      const nextYear = nextMonthDate.year()
      const nextMonth = nextMonthDate.month() + 1
      const d1Next = Math.min(day_of_month_1, daysInNextMonth)

      const periodStart = `${year}-${String(month).padStart(2, '0')}-${String(d1).padStart(2, '0')}`
      const periodEndDate = dayjs(
        `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d1Next).padStart(2, '0')}`,
      ).subtract(1, 'day')
      const periodEnd = periodEndDate.format('YYYY-MM-DD')

      const d2 = Math.min(day_of_month_2, daysInMonth)
      const sub1Start = periodStart
      const sub1End = dayjs(
        `${year}-${String(month).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
      )
        .subtract(1, 'day')
        .format('YYYY-MM-DD')

      const sub2Start = `${year}-${String(month).padStart(2, '0')}-${String(d2).padStart(2, '0')}`
      const sub2End = periodEnd

      return {
        periodStart,
        periodEnd,
        subPeriods: [
          { startDate: sub1Start, endDate: sub1End },
          { startDate: sub2Start, endDate: sub2End },
        ],
      }
    }

    case 'semimonthly': {
      if (!day_of_month_1 || !day_of_month_2) return null

      const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth()
      const d1 = Math.min(day_of_month_1, daysInMonth)

      const nextMonthDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(1, 'month')
      const daysInNextMonth = nextMonthDate.daysInMonth()
      const nextYear = nextMonthDate.year()
      const nextMonth = nextMonthDate.month() + 1
      const d1Next = Math.min(day_of_month_1, daysInNextMonth)

      const periodStart = `${year}-${String(month).padStart(2, '0')}-${String(d1).padStart(2, '0')}`
      const periodEndDate = dayjs(
        `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d1Next).padStart(2, '0')}`,
      ).subtract(1, 'day')
      const periodEnd = periodEndDate.format('YYYY-MM-DD')

      const d2 = Math.min(day_of_month_2, daysInMonth)
      const sub1Start = periodStart
      const sub1End = dayjs(
        `${year}-${String(month).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
      )
        .subtract(1, 'day')
        .format('YYYY-MM-DD')

      const sub2Start = `${year}-${String(month).padStart(2, '0')}-${String(d2).padStart(2, '0')}`
      const sub2End = periodEnd

      return {
        periodStart,
        periodEnd,
        subPeriods: [
          { startDate: sub1Start, endDate: sub1End },
          { startDate: sub2Start, endDate: sub2End },
        ],
      }
    }

    case 'biweekly': {
      if (!anchor_date) return null

      const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      const monthEnd = monthStart.endOf('month')
      const periodStart = monthStart.format('YYYY-MM-DD')
      const periodEnd = monthEnd.format('YYYY-MM-DD')

      const anchor = dayjs(anchor_date)
      const subPeriods: SubPeriodBoundary[] = []

      // Find the first paycheck on or after monthStart
      const diff = monthStart.diff(anchor, 'day')
      let weeksAhead = Math.ceil(diff / 14)
      if (weeksAhead < 0) weeksAhead = 0
      let paycheckDate = anchor.add(weeksAhead * 14, 'day')

      if (paycheckDate.isAfter(monthEnd)) return null

      const paycheckStarts: dayjs.Dayjs[] = []
      while (!paycheckDate.isAfter(monthEnd)) {
        paycheckStarts.push(paycheckDate)
        paycheckDate = paycheckDate.add(14, 'day')
      }

      for (let i = 0; i < paycheckStarts.length; i++) {
        const subStart = paycheckStarts[i]
        const subEnd =
          i < paycheckStarts.length - 1
            ? paycheckStarts[i + 1].subtract(1, 'day')
            : monthEnd
        subPeriods.push({
          startDate: subStart.format('YYYY-MM-DD'),
          endDate: subEnd.format('YYYY-MM-DD'),
        })
      }

      if (subPeriods.length === 0) return null

      return { periodStart, periodEnd, subPeriods }
    }

    case 'weekly': {
      if (day_of_week === null || day_of_week === undefined) return null

      const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      const monthEnd = monthStart.endOf('month')
      const periodStart = monthStart.format('YYYY-MM-DD')
      const periodEnd = monthEnd.format('YYYY-MM-DD')

      const subPeriods: SubPeriodBoundary[] = []
      let current = monthStart

      while (current.day() !== day_of_week) {
        current = current.add(1, 'day')
        if (current.isAfter(monthEnd)) break
      }

      const paycheckStarts: dayjs.Dayjs[] = []
      while (!current.isAfter(monthEnd)) {
        paycheckStarts.push(current)
        current = current.add(7, 'day')
      }

      for (let i = 0; i < paycheckStarts.length; i++) {
        const subStart = paycheckStarts[i]
        const subEnd =
          i < paycheckStarts.length - 1
            ? paycheckStarts[i + 1].subtract(1, 'day')
            : monthEnd
        subPeriods.push({
          startDate: subStart.format('YYYY-MM-DD'),
          endDate: subEnd.format('YYYY-MM-DD'),
        })
      }

      if (subPeriods.length === 0) return null

      return { periodStart, periodEnd, subPeriods }
    }

    case 'monthly': {
      const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      const monthEnd = monthStart.endOf('month')
      const periodStart = monthStart.format('YYYY-MM-DD')
      const periodEnd = monthEnd.format('YYYY-MM-DD')

      return {
        periodStart,
        periodEnd,
        subPeriods: [{ startDate: periodStart, endDate: periodEnd }],
      }
    }

    default:
      return null
  }
}

// ─── computeSurplus ──────────────────────────────────────────────────────────

/**
 * Computes surplus for period close.
 * Pure function — no database dependency.
 *
 * @param totalIncomeCents  Sum of income for the period (in cents)
 * @param totalSpentCents   Sum of spending for the period (in cents)
 * @returns Surplus in cents (positive = under-budget, negative = over-budget)
 */
export function computeSurplus(totalIncomeCents: number, totalSpentCents: number): number {
  return totalIncomeCents - totalSpentCents
}
