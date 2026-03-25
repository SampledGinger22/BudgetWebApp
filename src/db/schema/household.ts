import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { inviteStatusEnum } from './enums'

// Note: owner_id and invited_by reference users.id via AnyPgColumn to break
// the circular dependency between household.ts and auth.ts.
// The actual users table is defined in auth.ts.

export const households = pgTable('households', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  owner_id: text('owner_id'),
  max_members: integer('max_members').default(2),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const householdInvites = pgTable('household_invites', {
  id: serial('id').primaryKey(),
  household_id: integer('household_id')
    .references(() => households.id)
    .notNull(),
  email: text('email').notNull(),
  status: inviteStatusEnum('status').default('pending'),
  invited_by: text('invited_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
