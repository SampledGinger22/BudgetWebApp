import { z } from 'zod'

/** Validates POST/PUT body for upserting a budget allocation */
export const upsertAllocationSchema = z.object({
  budget_sub_period_id: z.number().int(),
  category_id: z.number().int(),
  allocated_cents: z.number().int().min(0),
  auto_split: z.number().int().min(0).max(1).optional(),
})

/** Validates POST body for creating a budget transfer between categories */
export const createTransferSchema = z.object({
  budget_sub_period_id: z.number().int(),
  from_category_id: z.number().int(),
  to_category_id: z.number().int(),
  amount_cents: z.number().int().min(1, 'Transfer amount must be positive'),
  note: z.string().nullable().optional(),
})

/** Validates POST body for reversing an existing transfer */
export const reverseTransferSchema = z.object({
  transferId: z.number().int(),
})

/** Validates POST body for copying allocations from one sub-period to another */
export const copyAllocationsSchema = z.object({
  sourceSubPeriodId: z.number().int(),
  targetSubPeriodId: z.number().int(),
  useActuals: z.boolean().optional(),
})
