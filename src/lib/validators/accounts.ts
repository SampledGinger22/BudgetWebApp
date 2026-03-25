import { z } from 'zod'

const accountTypes = [
  'checking',
  'savings',
  'credit',
  'student_loan',
  'standard_loan',
] as const

/** Validates POST body for creating a new account */
export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(accountTypes),
  opening_balance_cents: z.number().int().optional(),
  as_of_date: z.string().optional(),
  credit_limit_cents: z.number().int().optional(),
  interest_rate_basis_points: z.number().int().optional(),
  minimum_payment_cents: z.number().int().optional(),
  statement_date: z.number().int().optional(),
  interest_date: z.number().int().optional(),
})

/** Validates PATCH body for updating an existing account (all fields optional) */
export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(accountTypes).optional(),
  opening_balance_cents: z.number().int().optional(),
  as_of_date: z.string().nullable().optional(),
  credit_limit_cents: z.number().int().nullable().optional(),
  interest_rate_basis_points: z.number().int().nullable().optional(),
  minimum_payment_cents: z.number().int().nullable().optional(),
  statement_date: z.number().int().nullable().optional(),
  interest_date: z.number().int().nullable().optional(),
})

/** Validates POST body for reordering accounts */
export const reorderSchema = z.object({
  ids: z.array(z.number().int()).min(1, 'At least one account id is required'),
})
