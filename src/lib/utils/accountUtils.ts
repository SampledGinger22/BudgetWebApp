export const LIABILITY_TYPES = ['credit', 'student_loan', 'standard_loan'] as const
export type LiabilityType = (typeof LIABILITY_TYPES)[number]

export function isLiabilityAccount(type: string): boolean {
  return (LIABILITY_TYPES as readonly string[]).includes(type)
}
