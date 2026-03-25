import { index, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { recurringTxnStatusEnum } from './enums'
import { households } from './household'
import { accounts } from './accounts'
import { budgetSubPeriods, categories, vendors } from './budget'

// ─── Household Members ──────────────────────────────────────────────────────

export const householdMembers = pgTable('household_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  archived_at: timestamp('archived_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Transactions ───────────────────────────────────────────────────────────
// recurring_template_id uses bare integer (no direct FK import) to avoid
// circular import with recurring.ts. The FK constraint is still enforced
// at the database level via Drizzle's migration output.

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    account_id: integer('account_id')
      .references(() => accounts.id)
      .notNull(),
    budget_sub_period_id: integer('budget_sub_period_id').references(() => budgetSubPeriods.id),
    date: text('date').notNull(),
    description: text('description').notNull(),
    original_description: text('original_description').notNull(),
    amount_cents: integer('amount_cents').notNull(),
    is_debit: integer('is_debit').default(1).notNull(),
    category_id: integer('category_id').references(() => categories.id),
    vendor_id: integer('vendor_id').references(() => vendors.id),
    member_id: integer('member_id').references(() => householdMembers.id),
    reconciled_at: timestamp('reconciled_at', { withTimezone: true }),
    voided_at: timestamp('voided_at', { withTimezone: true }),
    recurring_template_id: integer('recurring_template_id'),
    recurring_status: recurringTxnStatusEnum('recurring_status'),
    estimated_amount_cents: integer('estimated_amount_cents'),
    fitid: text('fitid'),
    import_batch_id: integer('import_batch_id'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [
    index('idx_transactions_account_date').on(t.account_id, t.date, t.id),
    index('idx_transactions_sub_period').on(t.budget_sub_period_id),
    index('idx_transactions_category').on(t.category_id),
    index('idx_transactions_recurring_template').on(t.recurring_template_id),
    index('idx_transactions_recurring_status').on(t.recurring_status),
    index('idx_transactions_fitid').on(t.fitid),
    index('idx_transactions_import_batch').on(t.import_batch_id),
  ],
)

// ─── App Settings ───────────────────────────────────────────────────────────

export const appSettings = pgTable(
  'app_settings',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    value: text('value'),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [unique('uq_app_settings_key_household').on(t.key, t.household_id)],
)
