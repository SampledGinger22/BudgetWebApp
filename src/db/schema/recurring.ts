import { index, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { frequencyEnum, recurringStatusEnum, recurringTypeEnum } from './enums'
import { households } from './household'
import { accounts } from './accounts'
import { budgetSubPeriods, categories, vendors } from './budget'
import { householdMembers, transactions } from './transactions'

// ─── Recurring Templates ────────────────────────────────────────────────────

export const recurringTemplates = pgTable(
  'recurring_templates',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    vendor_id: integer('vendor_id').references(() => vendors.id),
    amount_cents: integer('amount_cents').default(0).notNull(),
    is_debit: integer('is_debit').default(1).notNull(),
    category_id: integer('category_id').references(() => categories.id),
    account_id: integer('account_id')
      .references(() => accounts.id)
      .notNull(),
    member_id: integer('member_id').references(() => householdMembers.id),
    type: recurringTypeEnum('type').default('bill').notNull(),
    frequency: frequencyEnum('frequency').default('monthly').notNull(),
    interval_n: integer('interval_n').default(1).notNull(),
    start_date: text('start_date'),
    end_date: text('end_date'),
    status: recurringStatusEnum('status').default('active').notNull(),
    auto_confirm: integer('auto_confirm').default(0).notNull(),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [index('idx_recurring_templates_status').on(t.status)],
)

// ─── Recurring Template Dates ───────────────────────────────────────────────

export const recurringTemplateDates = pgTable('recurring_template_dates', {
  id: serial('id').primaryKey(),
  template_id: integer('template_id')
    .references(() => recurringTemplates.id, { onDelete: 'cascade' })
    .notNull(),
  day_value: integer('day_value').notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Recurring Generation Log ───────────────────────────────────────────────

export const recurringGenerationLog = pgTable(
  'recurring_generation_log',
  {
    id: serial('id').primaryKey(),
    template_id: integer('template_id')
      .references(() => recurringTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    budget_sub_period_id: integer('budget_sub_period_id')
      .references(() => budgetSubPeriods.id, { onDelete: 'cascade' })
      .notNull(),
    scheduled_date: text('scheduled_date').notNull(),
    transaction_id: integer('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    user_deleted: integer('user_deleted').default(0).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [
    unique('uq_gen_log_template_date').on(t.template_id, t.scheduled_date),
    index('idx_recurring_gen_log_template').on(t.template_id),
    index('idx_recurring_gen_log_sub_period').on(t.budget_sub_period_id),
  ],
)

// ─── Recurring Dismissed Suggestions ────────────────────────────────────────

export const recurringDismissedSuggestions = pgTable(
  'recurring_dismissed_suggestions',
  {
    id: serial('id').primaryKey(),
    fingerprint: text('fingerprint').notNull(),
    dismissed_at: timestamp('dismissed_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [unique('uq_dismissed_fingerprint_household').on(t.fingerprint, t.household_id)],
)
