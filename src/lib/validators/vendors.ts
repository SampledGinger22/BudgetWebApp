import { z } from 'zod'

/** Validates POST body for creating a new vendor */
export const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  default_category_id: z.number().int().nullable().optional(),
})

/** Validates PATCH body for updating an existing vendor (all fields optional) */
export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  default_category_id: z.number().int().nullable().optional(),
})
