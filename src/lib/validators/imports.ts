import { z } from 'zod'

const importFormats = ['csv', 'qbo', 'ofx'] as const

/** Validates POST body for saving a new import profile */
export const saveProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required'),
  header_fingerprint: z.string().min(1, 'Header fingerprint is required'),
  mapping_json: z.string().min(1, 'Mapping JSON is required'),
})

/** Validates PATCH body for updating an import profile */
export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  header_fingerprint: z.string().min(1).optional(),
  mapping_json: z.string().min(1).optional(),
})

/** Transaction row shape for duplicate checking */
const importTransactionRow = z.object({
  date: z.string(),
  description: z.string(),
  amount_cents: z.number().int(),
  is_debit: z.number().int().min(0).max(1),
})

/** Validates POST body for checking duplicate transactions */
export const checkDuplicatesSchema = z.object({
  accountId: z.number().int(),
  transactions: z.array(importTransactionRow).min(1),
})

/** Validates POST body for checking FITID duplicates */
export const checkFitidSchema = z.object({
  accountId: z.number().int(),
  fitids: z.array(z.string()).min(1),
})

/** Transaction row shape for batch commit */
const commitTransactionRow = z.object({
  date: z.string(),
  description: z.string(),
  original_description: z.string().optional(),
  amount_cents: z.number().int(),
  is_debit: z.number().int().min(0).max(1),
  category_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  member_id: z.number().int().nullable().optional(),
  fitid: z.string().nullable().optional(),
})

/** Validates POST body for committing an import batch */
export const commitImportSchema = z.object({
  accountId: z.number().int(),
  filename: z.string().min(1),
  profileName: z.string().nullable().optional(),
  format: z.enum(importFormats).optional(),
  transactions: z.array(commitTransactionRow).min(1),
})
