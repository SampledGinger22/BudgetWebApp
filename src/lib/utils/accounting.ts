/**
 * Accounting utility functions shared across transaction, reconciliation,
 * recurring, and import domains.
 *
 * Encapsulates the asset/liability × debit/credit sign logic that was
 * previously duplicated in 6+ Electron IPC handlers.
 */

export const LIABILITY_TYPES = ['credit', 'student_loan', 'standard_loan'] as const

/**
 * Returns true if the account type is a liability (credit, student_loan, standard_loan).
 * Asset types (checking, savings) return false.
 */
export function isLiabilityAccount(type: string): boolean {
  return (LIABILITY_TYPES as readonly string[]).includes(type)
}

/**
 * Computes the signed delta to ADD to an account's balance_cents.
 *
 * The sign convention:
 *   Asset account (checking/savings):
 *     - Debit  → balance goes DOWN  → returns -amountCents
 *     - Credit → balance goes UP    → returns +amountCents
 *   Liability account (credit/student_loan/standard_loan):
 *     - Debit  → balance goes UP    → returns +amountCents
 *     - Credit → balance goes DOWN  → returns -amountCents
 *
 * @param amountCents   Always positive — the absolute transaction amount in cents
 * @param isDebit       1 for debit, 0 for credit (matches DB column convention)
 * @param accountType   One of: checking, savings, credit, student_loan, standard_loan
 * @returns Signed integer to add to balance_cents
 */
export function computeBalanceDelta(
  amountCents: number,
  isDebit: number,
  accountType: string,
): number {
  const liability = isLiabilityAccount(accountType)

  if (liability) {
    // Liability: debit increases balance, credit decreases
    return isDebit ? amountCents : -amountCents
  } else {
    // Asset: debit decreases balance, credit increases
    return isDebit ? -amountCents : amountCents
  }
}
