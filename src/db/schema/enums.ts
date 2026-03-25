import { pgEnum } from 'drizzle-orm/pg-core'

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit',
  'student_loan',
  'standard_loan',
])

export const scheduleTypeEnum = pgEnum('schedule_type', [
  'specific_dates',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
])

export const vendorTypeEnum = pgEnum('vendor_type', ['vendor', 'payee'])

export const recurringTypeEnum = pgEnum('recurring_type', [
  'bill',
  'income',
  'subscription',
  'credit_payment',
  'transfer',
  'investment',
])

export const frequencyEnum = pgEnum('frequency', ['monthly', 'weekly'])

export const recurringStatusEnum = pgEnum('recurring_status', ['active', 'paused', 'completed'])

export const recurringTxnStatusEnum = pgEnum('recurring_txn_status', ['expected', 'confirmed'])

export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'in_progress',
  'completed',
])

export const importFormatEnum = pgEnum('import_format', ['csv', 'qbo', 'ofx'])

export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'declined'])
