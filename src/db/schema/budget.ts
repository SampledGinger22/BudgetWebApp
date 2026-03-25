import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { scheduleTypeEnum, vendorTypeEnum } from './enums'
import { households } from './household'

// ─── Category Groups & Categories ───────────────────────────────────────────

export const categoryGroups = pgTable('category_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  is_system: integer('is_system').default(0),
  color: text('color'),
  sort_order: integer('sort_order').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    category_group_id: integer('category_group_id')
      .references(() => categoryGroups.id)
      .notNull(),
    parent_id: integer('parent_id').references((): AnyPgColumn => categories.id),
    name: text('name').notNull(),
    ref_number: text('ref_number'),
    sort_order: integer('sort_order').default(0).notNull(),
    archived_at: timestamp('archived_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [unique('uq_categories_ref_number_household').on(t.ref_number, t.household_id)],
)

// ─── Vendors ────────────────────────────────────────────────────────────────
// Defined here (not in transactions.ts) because pay_schedules references vendors,
// and vendors references categories — keeping them together avoids circular imports.

export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  default_category_id: integer('default_category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  type: vendorTypeEnum('type').default('vendor').notNull(),
  archived_at: timestamp('archived_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Pay Schedules ──────────────────────────────────────────────────────────
// household_member_id and recurring_template_id use AnyPgColumn to avoid
// circular imports with transactions.ts and recurring.ts.

export const paySchedules = pgTable('pay_schedules', {
  id: serial('id').primaryKey(),
  name: text('name').default('Primary').notNull(),
  schedule_type: scheduleTypeEnum('schedule_type').notNull(),
  day_of_month_1: integer('day_of_month_1'),
  day_of_month_2: integer('day_of_month_2'),
  day_of_week: integer('day_of_week'),
  anchor_date: text('anchor_date'),
  is_primary: integer('is_primary').default(0).notNull(),
  amount_cents: integer('amount_cents'),
  household_member_id: integer('household_member_id'),
  income_category_id: integer('income_category_id').references(() => categories.id),
  vendor_id: integer('vendor_id').references(() => vendors.id),
  end_date: text('end_date'),
  recurring_template_id: integer('recurring_template_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Pay Schedule History ───────────────────────────────────────────────────

export const payScheduleHistory = pgTable(
  'pay_schedule_history',
  {
    id: serial('id').primaryKey(),
    pay_schedule_id: integer('pay_schedule_id')
      .references(() => paySchedules.id, { onDelete: 'cascade' })
      .notNull(),
    effective_date: text('effective_date').notNull(),
    amount_cents: integer('amount_cents').notNull(),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [index('idx_pay_schedule_history_schedule').on(t.pay_schedule_id, t.effective_date)],
)

// ─── Budget Periods & Sub-Periods ───────────────────────────────────────────

export const budgetPeriods = pgTable('budget_periods', {
  id: serial('id').primaryKey(),
  pay_schedule_id: integer('pay_schedule_id')
    .references(() => paySchedules.id)
    .notNull(),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  is_customized: integer('is_customized').default(0).notNull(),
  notes: text('notes'),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  locked_at: timestamp('locked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

export const budgetSubPeriods = pgTable('budget_sub_periods', {
  id: serial('id').primaryKey(),
  budget_period_id: integer('budget_period_id')
    .references(() => budgetPeriods.id, { onDelete: 'cascade' })
    .notNull(),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  surplus_carry_forward_cents: integer('surplus_carry_forward_cents').default(0).notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  locked_at: timestamp('locked_at', { withTimezone: true }),
  is_carry_only: integer('is_carry_only').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Period Income Lines ────────────────────────────────────────────────────

export const periodIncomeLines = pgTable('period_income_lines', {
  id: serial('id').primaryKey(),
  budget_sub_period_id: integer('budget_sub_period_id')
    .references(() => budgetSubPeriods.id, { onDelete: 'cascade' })
    .notNull(),
  label: text('label').notNull(),
  expected_cents: integer('expected_cents').default(0).notNull(),
  actual_cents: integer('actual_cents'),
  category_id: integer('category_id').references(() => categories.id),
  sort_order: integer('sort_order').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Period Audit Log ───────────────────────────────────────────────────────

export const periodAuditLog = pgTable('period_audit_log', {
  id: serial('id').primaryKey(),
  budget_sub_period_id: integer('budget_sub_period_id').references(() => budgetSubPeriods.id),
  changed_at: timestamp('changed_at', { withTimezone: true }).defaultNow(),
  changed_field: text('changed_field').notNull(),
  old_value: text('old_value'),
  new_value: text('new_value'),
  reason: text('reason'),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Budget Allocations ─────────────────────────────────────────────────────

export const budgetAllocations = pgTable(
  'budget_allocations',
  {
    id: serial('id').primaryKey(),
    budget_sub_period_id: integer('budget_sub_period_id')
      .references(() => budgetSubPeriods.id, { onDelete: 'cascade' })
      .notNull(),
    category_id: integer('category_id')
      .references(() => categories.id)
      .notNull(),
    allocated_cents: integer('allocated_cents').default(0).notNull(),
    auto_split: integer('auto_split').default(0).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [unique('uq_allocation_sub_period_category').on(t.budget_sub_period_id, t.category_id)],
)

// ─── Budget Transfers ───────────────────────────────────────────────────────

export const budgetTransfers = pgTable(
  'budget_transfers',
  {
    id: serial('id').primaryKey(),
    budget_sub_period_id: integer('budget_sub_period_id')
      .references(() => budgetSubPeriods.id, { onDelete: 'cascade' })
      .notNull(),
    from_category_id: integer('from_category_id')
      .references(() => categories.id)
      .notNull(),
    to_category_id: integer('to_category_id')
      .references(() => categories.id)
      .notNull(),
    amount_cents: integer('amount_cents').notNull(),
    note: text('note'),
    reversal_of_id: integer('reversal_of_id').references(
      (): AnyPgColumn => budgetTransfers.id,
    ),
    from_category_name: text('from_category_name').notNull(),
    to_category_name: text('to_category_name').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [
    check('ck_transfer_amount_positive', sql`${t.amount_cents} > 0`),
    index('idx_transfers_sub_period').on(t.budget_sub_period_id),
    index('idx_transfers_from_cat').on(t.from_category_id),
    index('idx_transfers_to_cat').on(t.to_category_id),
  ],
)
