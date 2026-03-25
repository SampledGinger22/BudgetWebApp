import { z } from 'zod'

const recurringTypes = [
  'bill',
  'income',
  'subscription',
  'credit_payment',
  'transfer',
  'investment',
] as const

const frequencies = ['monthly', 'weekly'] as const
const recurringStatuses = ['active', 'paused', 'completed'] as const

/** Validates POST body for creating a new recurring template */
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  vendor_id: z.number().int().nullable().optional(),
  amount_cents: z.number().int().min(0),
  is_debit: z.number().int().min(0).max(1),
  category_id: z.number().int().nullable().optional(),
  account_id: z.number().int(),
  member_id: z.number().int().nullable().optional(),
  type: z.enum(recurringTypes).optional(),
  frequency: z.enum(frequencies).optional(),
  interval_n: z.number().int().min(1).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: z.enum(recurringStatuses).optional(),
  auto_confirm: z.number().int().min(0).max(1).optional(),
  notes: z.string().nullable().optional(),
  day_values: z.array(z.number().int()).min(1, 'At least one day value is required'),
})

/** Validates PATCH body for updating a recurring template (all fields optional) */
export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  vendor_id: z.number().int().nullable().optional(),
  amount_cents: z.number().int().min(0).optional(),
  is_debit: z.number().int().min(0).max(1).optional(),
  category_id: z.number().int().nullable().optional(),
  account_id: z.number().int().optional(),
  member_id: z.number().int().nullable().optional(),
  type: z.enum(recurringTypes).optional(),
  frequency: z.enum(frequencies).optional(),
  interval_n: z.number().int().min(1).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: z.enum(recurringStatuses).optional(),
  auto_confirm: z.number().int().min(0).max(1).optional(),
  notes: z.string().nullable().optional(),
  day_values: z.array(z.number().int()).min(1).optional(),
})

/** Validates POST body for confirming a single recurring entry */
export const confirmSchema = z.object({
  transactionId: z.number().int(),
  actualAmountCents: z.number().int().min(0).optional(),
})

/** Validates POST body for bulk-confirming multiple recurring entries */
export const bulkConfirmSchema = z.object({
  transactionIds: z.array(z.number().int()).min(1, 'At least one transaction is required'),
})
