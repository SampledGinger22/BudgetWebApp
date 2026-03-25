import { z } from 'zod'

/** Validates POST body for creating a new transaction */
export const createTransactionSchema = z.object({
  account_id: z.number().int(),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  amount_cents: z.number().int().min(0),
  is_debit: z.number().int().min(0).max(1),
  category_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  member_id: z.number().int().nullable().optional(),
  recurring_template_id: z.number().int().nullable().optional(),
  recurring_status: z.enum(['expected', 'confirmed']).nullable().optional(),
  estimated_amount_cents: z.number().int().nullable().optional(),
  fitid: z.string().nullable().optional(),
  import_batch_id: z.number().int().nullable().optional(),
})

/** Validates PATCH body for updating a transaction (all fields optional) */
export const updateTransactionSchema = z.object({
  date: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount_cents: z.number().int().min(0).optional(),
  is_debit: z.number().int().min(0).max(1).optional(),
  category_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  member_id: z.number().int().nullable().optional(),
  budget_sub_period_id: z.number().int().nullable().optional(),
})

/** Validates query parameters for listing transactions */
export const listTransactionsQuerySchema = z.object({
  accountId: z.coerce.number().int(),
  subPeriodId: z.coerce.number().int().optional(),
  category_id: z.coerce.number().int().optional(),
  member_id: z.coerce.number().int().optional(),
  vendor_id: z.coerce.number().int().optional(),
  search: z.string().optional(),
  amount_min: z.coerce.number().int().optional(),
  amount_max: z.coerce.number().int().optional(),
  import_batch_id: z.coerce.number().int().optional(),
  reconciled_status: z.enum(['reconciled', 'unreconciled', 'all']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
})
