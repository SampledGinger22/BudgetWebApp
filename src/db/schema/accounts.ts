import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { accountTypeEnum } from './enums'
import { households } from './household'

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  balance_cents: integer('balance_cents').default(0).notNull(),
  opening_balance_cents: integer('opening_balance_cents').default(0).notNull(),
  as_of_date: text('as_of_date'),
  credit_limit_cents: integer('credit_limit_cents'),
  interest_rate_basis_points: integer('interest_rate_basis_points'),
  minimum_payment_cents: integer('minimum_payment_cents'),
  statement_date: integer('statement_date'),
  interest_date: integer('interest_date'),
  sort_order: integer('sort_order').default(0).notNull(),
  archived_at: timestamp('archived_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})
