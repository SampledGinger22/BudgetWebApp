import { z } from 'zod'

/** Validates POST body for creating a new category group */
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  color: z.string().optional(),
})

/** Validates POST body for creating a new category */
export const createCategorySchema = z.object({
  category_group_id: z.number().int(),
  parent_id: z.number().int().nullable().optional(),
  name: z.string().min(1, 'Category name is required'),
  ref_number: z.string().optional(),
})

/** Validates PATCH body for updating an existing category */
export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  ref_number: z.string().nullable().optional(),
})

/** Validates POST body for reordering categories within a group */
export const reorderCategoriesSchema = z.object({
  groupId: z.number().int(),
  ids: z.array(z.number().int()).min(1, 'At least one category id is required'),
})
