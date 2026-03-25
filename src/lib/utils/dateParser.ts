import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

export const CANDIDATE_DATE_FORMATS = [
  'MM/DD/YYYY',
  'M/D/YYYY',
  'MM/DD/YY',
  'M/D/YY',
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'D/M/YYYY',
  'DD/MM/YY',
  'MMM D, YYYY',
  'MMMM D, YYYY',
  'MM-DD-YYYY',
  'MM-DD-YY',
  'YYYY/MM/DD',
  'DD-MMM-YYYY',
  'DD-MMM-YY',
]

/**
 * Detect date format from sample date strings.
 * Tests each candidate format against all samples (strict mode).
 * Returns first format where ALL non-empty samples parse successfully.
 */
export function detectDateFormat(samples: string[]): string | null {
  const filtered = samples.filter((s) => s && s.trim())
  if (filtered.length === 0) return null

  for (const format of CANDIDATE_DATE_FORMATS) {
    const allValid = filtered.every((s) => dayjs(s.trim(), format, true).isValid())
    if (allValid) return format
  }
  return null
}

/**
 * Parse a date string with the given format.
 * Returns YYYY-MM-DD normalized date string, or null on failure.
 */
export function parseDate(raw: string, format: string): string | null {
  const d = dayjs(raw.trim(), format, true)
  return d.isValid() ? d.format('YYYY-MM-DD') : null
}

/**
 * Format a sample date for user preview.
 * Shows "Jan 15, 2026" style for confirmation UI.
 */
export function formatSampleDate(raw: string, format: string): string | null {
  const d = dayjs(raw.trim(), format, true)
  return d.isValid() ? d.format('MMM D, YYYY') : null
}
