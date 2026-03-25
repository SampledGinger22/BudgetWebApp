import { z } from 'zod'

/** Validates POST body for starting a new reconciliation session */
export const startSessionSchema = z.object({
  accountId: z.number().int(),
  statementDate: z.string().min(1, 'Statement date is required'),
  statementBalanceCents: z.number().int(),
})

/** Validates PUT body for updating cleared transaction IDs */
export const updateClearedSchema = z.object({
  clearedIds: z.array(z.number().int()),
})

/** Validates POST body for undoing a completed reconciliation session */
export const undoSessionSchema = z.object({
  sessionId: z.number().int(),
})
