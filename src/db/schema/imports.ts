import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { importFormatEnum } from './enums'
import { households } from './household'
import { accounts } from './accounts'

// ─── Import Batches ─────────────────────────────────────────────────────────

export const importBatches = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  profile_name: text('profile_name'),
  account_id: integer('account_id')
    .references(() => accounts.id)
    .notNull(),
  row_count: integer('row_count').default(0).notNull(),
  format: importFormatEnum('format').default('csv').notNull(),
  imported_at: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
})

// ─── Import Profiles ────────────────────────────────────────────────────────

export const importProfiles = pgTable(
  'import_profiles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    header_fingerprint: text('header_fingerprint').notNull(),
    mapping_json: text('mapping_json').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    household_id: integer('household_id')
      .references(() => households.id)
      .notNull(),
  },
  (t) => [index('idx_import_profiles_fingerprint').on(t.header_fingerprint)],
)
