import { z } from 'zod'

/** Validates the `key` query param for GET /api/settings */
export const settingsGetSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
})

/** Validates the POST body for POST /api/settings (upsert) */
export const settingsSetSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.string(),
})
