import Papa from 'papaparse'

export interface CsvParseResult {
  headers: string[]
  rows: string[][]
  detectedDelimiter: string
  headerRowIndex: number
  detectedEncoding: string
  totalRows: number
}

/**
 * Decode raw file bytes to text string — browser-compatible.
 * Tries UTF-8 first; if replacement characters (U+FFFD) are found,
 * falls back to ISO-8859-1 (latin1) which maps all byte values 1:1.
 * Strips UTF-8 BOM if present.
 */
export function decodeFileBytes(bytes: Uint8Array): { text: string; encoding: string } {
  // Try UTF-8 first
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false })
  const utf8Text = utf8Decoder.decode(bytes)

  // Check for replacement characters indicating encoding issues
  if (!utf8Text.includes('\uFFFD')) {
    const clean = utf8Text.startsWith('\uFEFF') ? utf8Text.slice(1) : utf8Text
    return { text: clean, encoding: 'UTF-8' }
  }

  // Fall back to ISO-8859-1 (latin1) — maps all 256 byte values
  const latin1Decoder = new TextDecoder('iso-8859-1')
  const latin1Text = latin1Decoder.decode(bytes)
  const clean = latin1Text.startsWith('\uFEFF') ? latin1Text.slice(1) : latin1Text
  return { text: clean, encoding: 'ISO-8859-1' }
}

/**
 * Parse CSV text using PapaParse with RFC 4180 compliance.
 * Returns raw rows (no header interpretation) for manual header detection.
 */
export function parseCsvText(text: string, headerRowIndex = 0): CsvParseResult {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy', // skip blank + whitespace-only
    dynamicTyping: false, // all values stay as strings
  })

  const allRows = result.data as string[][]
  const detectedDelimiter = result.meta.delimiter ?? ','
  const headers = allRows[headerRowIndex] ?? []
  const dataRows = allRows.slice(headerRowIndex + 1)

  return {
    headers,
    rows: dataRows,
    detectedDelimiter,
    headerRowIndex,
    detectedEncoding: 'auto', // set by caller from decodeFileBytes
    totalRows: dataRows.length,
  }
}

/**
 * Build order-independent fingerprint for profile auto-detection.
 * Sort headers, lowercase, join with '|'.
 */
export function buildFingerprint(headers: string[]): string {
  return [...headers]
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join('|')
}

/**
 * Auto-detect which row is the header by finding the first row
 * where all cells are non-empty strings (no numbers-only, no dates).
 * Returns 0 if detection fails.
 */
export function detectHeaderRow(allRows: string[][]): number {
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i]
    if (!row || row.length < 2) continue
    const allText = row.every((cell) => {
      const trimmed = cell.trim()
      if (!trimmed) return false
      // Header cells are typically non-numeric text
      return isNaN(Number(trimmed.replace(/[$,]/g, '')))
    })
    if (allText) return i
  }
  return 0
}

/**
 * Auto-detect column mappings from header names.
 * Returns partial mapping config based on common header patterns.
 */
export function autoDetectColumns(headers: string[]): Partial<{
  dateColumn: number
  descriptionColumn: number
  amountColumn: number
  debitColumn: number
  creditColumn: number
  typeColumn: number
}> {
  const result: Record<string, number> = {}
  const lower = headers.map((h) => h.trim().toLowerCase())

  // Date column: date, posted date, transaction date, post date
  const dateIdx = lower.findIndex((h) =>
    /^(date|posted\s*date|transaction\s*date|post\s*date|posting\s*date)$/.test(h),
  )
  if (dateIdx >= 0) result.dateColumn = dateIdx

  // Description: description, memo, details, narrative, payee
  const descIdx = lower.findIndex((h) =>
    /^(description|memo|details|narrative|payee|transaction\s*description)$/.test(h),
  )
  if (descIdx >= 0) result.descriptionColumn = descIdx

  // Amount (single): amount, transaction amount
  const amtIdx = lower.findIndex((h) => /^(amount|transaction\s*amount|value)$/.test(h))
  if (amtIdx >= 0) result.amountColumn = amtIdx

  // Debit column
  const debitIdx = lower.findIndex((h) => /^(debit|debits|withdrawal|withdrawals)$/.test(h))
  if (debitIdx >= 0) result.debitColumn = debitIdx

  // Credit column
  const creditIdx = lower.findIndex((h) => /^(credit|credits|deposit|deposits)$/.test(h))
  if (creditIdx >= 0) result.creditColumn = creditIdx

  // Type column
  const typeIdx = lower.findIndex((h) => /^(type|transaction\s*type|trans\s*type)$/.test(h))
  if (typeIdx >= 0) result.typeColumn = typeIdx

  return result
}

/**
 * Check if a row looks like a summary/total row (no valid date, contains "Total", "Balance").
 */
export function isSummaryRow(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase()
  return /\b(total|balance|summary|subtotal)\b/.test(joined)
}
