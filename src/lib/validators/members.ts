import { z } from 'zod'

/** Validates POST body for creating a new household member */
export const createMemberSchema = z.object({
  name: z.string().min(1, 'Member name is required'),
  initials: z.string().min(1, 'Initials are required'),
  color: z.string().min(1, 'Color is required'),
})

/** Validates PATCH body for updating an existing member (all fields optional) */
export const updateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  initials: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
})

/** Validates POST body for reordering members */
export const reorderMembersSchema = z.object({
  ids: z.array(z.number().int()).min(1, 'At least one member id is required'),
})
