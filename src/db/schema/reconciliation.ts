import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { reconciliationStatusEnum } from './enums'
import { households } from './household'
import { accounts } from './accounts'

export const reconciliationSessions = pgTable(
  'reconciliation_sessions',
  {
    id: serial('id').primaryKey(),
    account_id: integer('account_id')
      .references(() => accounts.id)
      .notNull(),
    statement_date: text('statement_date').notNull(),
    statement_balance_cents: integer('statement_balance_cents').notNull(),
    status: reconciliationStatusEnum('status').default('in_progress').notNull(),
    cleared_transaction_ids: text('cleared_transaction_ids'),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [index('idx_recon_sessions_account').on(t.account_id, t.status)],
)
