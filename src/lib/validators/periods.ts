import { z } from 'zod'

const scheduleTypes = [
  'specific_dates',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
] as const

/** Validates POST body for saving (creating or updating) a pay schedule */
export const saveScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required'),
  schedule_type: z.enum(scheduleTypes),
  day_of_month_1: z.number().int().nullable().optional(),
  day_of_month_2: z.number().int().nullable().optional(),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  anchor_date: z.string().nullable().optional(),
  is_primary: z.number().int().min(0).max(1).optional(),
  amount_cents: z.number().int().nullable().optional(),
  household_member_id: z.number().int().nullable().optional(),
  income_category_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  end_date: z.string().nullable().optional(),
  recurring_template_id: z.number().int().nullable().optional(),
})

/** Validates POST body for creating a new pay schedule */
export const createScheduleSchema = saveScheduleSchema

/** Validates PATCH body for updating a pay schedule (all fields optional) */
export const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  schedule_type: z.enum(scheduleTypes).optional(),
  day_of_month_1: z.number().int().nullable().optional(),
  day_of_month_2: z.number().int().nullable().optional(),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  anchor_date: z.string().nullable().optional(),
  is_primary: z.number().int().min(0).max(1).optional(),
  amount_cents: z.number().int().nullable().optional(),
  household_member_id: z.number().int().nullable().optional(),
  income_category_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  end_date: z.string().nullable().optional(),
  recurring_template_id: z.number().int().nullable().optional(),
})

/** Validates PATCH body for updating a sub-period's dates */
export const updateSubPeriodSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().nullable().optional(),
})

/** Validates POST body for adding an income line to a sub-period */
export const addIncomeLineSchema = z.object({
  budget_sub_period_id: z.number().int(),
  label: z.string().min(1, 'Income label is required'),
  expected_cents: z.number().int().min(0).optional(),
  actual_cents: z.number().int().nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  sort_order: z.number().int().optional(),
})

/** Validates PATCH body for updating an income line */
export const updateIncomeLineSchema = z.object({
  label: z.string().min(1).optional(),
  expected_cents: z.number().int().min(0).optional(),
  actual_cents: z.number().int().nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  sort_order: z.number().int().optional(),
})

/** Validates POST body for adding a pay change entry */
export const addPayChangeSchema = z.object({
  pay_schedule_id: z.number().int(),
  effective_date: z.string().min(1, 'Effective date is required'),
  amount_cents: z.number().int().min(0),
  notes: z.string().nullable().optional(),
})

/** Validates PATCH body for updating a pay change entry */
export const updatePayChangeSchema = z.object({
  effective_date: z.string().min(1).optional(),
  amount_cents: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
})

/** Validates POST body for generating budget periods */
export const generatePeriodsSchema = z.object({
  scheduleId: z.number().int(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  count: z.number().int().min(1).max(24).optional(),
})
