/**
 * Period boundary computation utilities — safe for browser use.
 * These are pure dayjs functions with no server or Electron dependencies.
 */
import dayjs from 'dayjs'

export interface SubPeriodBoundary {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export type ScheduleType = 'specific_dates' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

/** Minimal schedule shape needed for boundary computation */
export interface ScheduleForPreview {
  schedule_type: ScheduleType
  day_of_month_1: number | null
  day_of_month_2: number | null
  day_of_week: number | null
  anchor_date: string | null
}

/**
 * Computes monthly period boundaries and their sub-period splits based on an income schedule.
 * Pure function — no side effects, no IPC, no DB access.
 */
export function computePeriodBoundaries(
  schedule: ScheduleForPreview,
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
