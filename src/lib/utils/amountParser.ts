/**
 * Parse a raw amount string from CSV into integer cents and debit flag.
 * Strips: $, commas, spaces. Converts (1234.56) to negative.
 * Uses Math.round for IEEE 754 safety (project convention from money.ts).
 */
export function parseAmountCents(
  raw: string,
  signConvention: 'positive-income' | 'positive-expense' = 'positive-income',
): { cents: number; isDebit: number } | null {
  if (!raw || raw.trim() === '') return null

  const cleaned = raw
    .trim()
    .replace(/[$,\s]/g, '') // strip $, commas, spaces
    .replace(/\(([^)]+)\)/, '-$1') // (1234.56) → -1234.56

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  const cents = Math.round(Math.abs(num) * 100)
  const isNegative = num < 0

  // Sign convention:
  // 'positive-income': positive number = credit (income), negative = debit (expense)
  // 'positive-expense': positive number = debit (expense), negative = credit (income)
  const isDebit: number =
    signConvention === 'positive-income' ? (isNegative ? 1 : 0) : isNegative ? 0 : 1

  return { cents, isDebit }
}

/**
 * Parse split debit/credit columns into a single amount.
 * Returns null if both columns are empty. Debit column → is_debit=1, credit column → is_debit=0.
 */
export function parseSplitAmountCents(
  debitRaw: string | undefined,
  creditRaw: string | undefined,
): { cents: number; isDebit: number } | null {
  const debitClean =
    debitRaw?.trim().replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1') ?? ''
  const creditClean =
    creditRaw?.trim().replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1') ?? ''

  const debitNum = debitClean ? parseFloat(debitClean) : NaN
  const creditNum = creditClean ? parseFloat(creditClean) : NaN

  if (!isNaN(debitNum) && debitNum !== 0) {
    return { cents: Math.round(Math.abs(debitNum) * 100), isDebit: 1 }
  }
  if (!isNaN(creditNum) && creditNum !== 0) {
    return { cents: Math.round(Math.abs(creditNum) * 100), isDebit: 0 }
  }

  return null
}

/**
 * Determine debit/credit from a type column value using user-configured mappings.
 * Returns is_debit (0|1) or null if type value not in mappings.
 */
export function resolveTypeColumn(
  typeValue: string,
  mappings: Record<string, 'debit' | 'credit'>,
): number | null {
  const normalized = typeValue.trim().toLowerCase()
  for (const [key, dir] of Object.entries(mappings)) {
    if (key.toLowerCase() === normalized) {
      return dir === 'debit' ? 1 : 0
    }
  }
  return null
}
