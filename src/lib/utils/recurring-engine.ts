/**
 * Recurring engine — generates transactions from recurring templates.
 *
 * The generateRecurringEntries() function is the core shared utility used by:
 * 1. POST /api/recurring/sync — sync all templates for a sub-period
 * 2. POST /api/recurring/[id]/generate — generate for one template
 * 3. POST /api/periods/generate — after creating new sub-periods
 *
 * Design:
 * - Loads sub-period, skips if closed
 * - Loads all active templates + their template_dates
 * - Computes occurrences via computeOccurrences() from budget-engine
 * - Skips dates already in generation_log (idempotent)
 * - Inserts transaction + updates account balance + inserts log entry sequentially
 * - No db.transaction() — compatible with neon-http driver
 */

import { eq, and, sql, inArray } from 'drizzle-orm'
import type { Database } from '@/db'
import { budgetSubPeriods } from '@/db/schema/budget'
import { accounts } from '@/db/schema/accounts'
import { transactions } from '@/db/schema/transactions'
import {
  recurringTemplates,
  recurringTemplateDates,
  recurringGenerationLog,
} from '@/db/schema/recurring'
import { computeOccurrences } from '@/lib/utils/budget-engine'
import { computeBalanceDelta } from '@/lib/utils/accounting'

export interface GenerationResult {
  insertedCount: number
  skippedCount: number
  templateResults: Array<{
    templateId: number
    templateName: string
    generatedDates: string[]
    skippedDates: string[]
  }>
}

/**
 * Generate recurring entries for all active templates in a sub-period.
 *
 * Idempotent: skips any date already in the generation_log for a given template.
 *
 * @param db          Drizzle database client
 * @param subPeriodId The budget sub-period to generate entries for
 * @param householdId Household scope
 * @returns Summary of what was generated and what was skipped
 */
export async function generateRecurringEntries(
  db: Database,
  subPeriodId: number,
  householdId: number,
): Promise<GenerationResult> {
  const result: GenerationResult = {
    insertedCount: 0,
    skippedCount: 0,
    templateResults: [],
  }

  // 1. Load the sub-period — skip if closed
  const [subPeriod] = await db
    .select()
    .from(budgetSubPeriods)
    .where(
      and(
        eq(budgetSubPeriods.id, subPeriodId),
        eq(budgetSubPeriods.household_id, householdId),
      ),
    )
    .limit(1)

  if (!subPeriod) return result
  if (subPeriod.closed_at) return result

  // 2. Load all active templates for this household
  const activeTemplates = await db
    .select()
    .from(recurringTemplates)
    .where(
      and(
        eq(recurringTemplates.household_id, householdId),
        eq(recurringTemplates.status, 'active'),
      ),
    )

  if (activeTemplates.length === 0) return result

  // 3. Load all template dates for active templates
  const templateIds = activeTemplates.map((t) => t.id)
  const allTemplateDates = await db
    .select()
    .from(recurringTemplateDates)
    .where(inArray(recurringTemplateDates.template_id, templateIds))

  // Group dates by template_id
  const datesByTemplate = new Map<number, Array<{ day_value: number }>>()
  for (const td of allTemplateDates) {
    const list = datesByTemplate.get(td.template_id) ?? []
    list.push({ day_value: td.day_value })
    datesByTemplate.set(td.template_id, list)
  }

  // 4. Load existing log entries for this sub-period to skip duplicates
  const existingLogs = await db
    .select({
      template_id: recurringGenerationLog.template_id,
      scheduled_date: recurringGenerationLog.scheduled_date,
    })
    .from(recurringGenerationLog)
    .where(
      and(
        eq(recurringGenerationLog.budget_sub_period_id, subPeriodId),
        eq(recurringGenerationLog.household_id, householdId),
      ),
    )

  const loggedSet = new Set(existingLogs.map((l) => `${l.template_id}:${l.scheduled_date}`))

  // 5. For each template, compute occurrences and generate entries
  for (const template of activeTemplates) {
    const templateDates = datesByTemplate.get(template.id) ?? []
    if (templateDates.length === 0) continue

    const occurrences = computeOccurrences(
      {
        frequency: template.frequency,
        interval_n: template.interval_n,
        start_date: template.start_date,
        end_date: template.end_date,
      },
      templateDates,
      subPeriod.start_date,
      subPeriod.end_date,
    )

    const templateResult = {
      templateId: template.id,
      templateName: template.name,
      generatedDates: [] as string[],
      skippedDates: [] as string[],
    }

    for (const dateStr of occurrences) {
      const logKey = `${template.id}:${dateStr}`

      // Skip if already generated (idempotent)
      if (loggedSet.has(logKey)) {
        templateResult.skippedDates.push(dateStr)
        result.skippedCount++
        continue
      }

      // Fetch the account to determine type for balance delta
      const [account] = await db
        .select({ id: accounts.id, type: accounts.type })
        .from(accounts)
        .where(
          and(eq(accounts.id, template.account_id), eq(accounts.household_id, householdId)),
        )
        .limit(1)

      if (!account) continue

      // Compute balance delta
      const delta = computeBalanceDelta(template.amount_cents, template.is_debit, account.type)

      // Insert transaction
      const [txn] = await db
        .insert(transactions)
        .values({
          account_id: template.account_id,
          budget_sub_period_id: subPeriodId,
          date: dateStr,
          description: template.name,
          original_description: template.name,
          amount_cents: template.amount_cents,
          is_debit: template.is_debit,
          category_id: template.category_id,
          vendor_id: template.vendor_id,
          member_id: template.member_id,
          recurring_template_id: template.id,
          recurring_status: 'expected',
          estimated_amount_cents: template.amount_cents,
          household_id: householdId,
        })
        .returning()

      // Update account balance
      await db
        .update(accounts)
        .set({ balance_cents: sql`${accounts.balance_cents} + ${delta}` })
        .where(eq(accounts.id, template.account_id))

      // Insert generation log entry
      await db.insert(recurringGenerationLog).values({
        template_id: template.id,
        budget_sub_period_id: subPeriodId,
        scheduled_date: dateStr,
        transaction_id: txn.id,
        household_id: householdId,
      })

      // Mark as logged so subsequent occurrences within the same run are also idempotent
      loggedSet.add(logKey)

      templateResult.generatedDates.push(dateStr)
      result.insertedCount++
    }

    result.templateResults.push(templateResult)
  }

  return result
}

/**
 * Generate recurring entries for a single template in a sub-period.
 * Same logic as generateRecurringEntries but scoped to one template.
 */
export async function generateForOneTemplate(
  db: Database,
  templateId: number,
  subPeriodId: number,
  householdId: number,
): Promise<GenerationResult> {
  const result: GenerationResult = {
    insertedCount: 0,
    skippedCount: 0,
    templateResults: [],
  }

  // Load sub-period
  const [subPeriod] = await db
    .select()
    .from(budgetSubPeriods)
    .where(
      and(
        eq(budgetSubPeriods.id, subPeriodId),
        eq(budgetSubPeriods.household_id, householdId),
      ),
    )
    .limit(1)

  if (!subPeriod) return result
  if (subPeriod.closed_at) return result

  // Load template
  const [template] = await db
    .select()
    .from(recurringTemplates)
    .where(
      and(
        eq(recurringTemplates.id, templateId),
        eq(recurringTemplates.household_id, householdId),
      ),
    )
    .limit(1)

  if (!template || template.status !== 'active') return result

  // Load template dates
  const templateDates = await db
    .select()
    .from(recurringTemplateDates)
    .where(eq(recurringTemplateDates.template_id, templateId))

  if (templateDates.length === 0) return result

  // Load existing log entries
  const existingLogs = await db
    .select({
      scheduled_date: recurringGenerationLog.scheduled_date,
    })
    .from(recurringGenerationLog)
    .where(
      and(
        eq(recurringGenerationLog.template_id, templateId),
        eq(recurringGenerationLog.budget_sub_period_id, subPeriodId),
        eq(recurringGenerationLog.household_id, householdId),
      ),
    )

  const loggedDates = new Set(existingLogs.map((l) => l.scheduled_date))

  const occurrences = computeOccurrences(
    {
      frequency: template.frequency,
      interval_n: template.interval_n,
      start_date: template.start_date,
      end_date: template.end_date,
    },
    templateDates.map((td) => ({ day_value: td.day_value })),
    subPeriod.start_date,
    subPeriod.end_date,
  )

  const templateResult = {
    templateId: template.id,
    templateName: template.name,
    generatedDates: [] as string[],
    skippedDates: [] as string[],
  }

  for (const dateStr of occurrences) {
    if (loggedDates.has(dateStr)) {
      templateResult.skippedDates.push(dateStr)
      result.skippedCount++
      continue
    }

    const [account] = await db
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, template.account_id), eq(accounts.household_id, householdId)))
      .limit(1)

    if (!account) continue

    const delta = computeBalanceDelta(template.amount_cents, template.is_debit, account.type)

    const [txn] = await db
      .insert(transactions)
      .values({
        account_id: template.account_id,
        budget_sub_period_id: subPeriodId,
        date: dateStr,
        description: template.name,
        original_description: template.name,
        amount_cents: template.amount_cents,
        is_debit: template.is_debit,
        category_id: template.category_id,
        vendor_id: template.vendor_id,
        member_id: template.member_id,
        recurring_template_id: template.id,
        recurring_status: 'expected',
        estimated_amount_cents: template.amount_cents,
        household_id: householdId,
      })
      .returning()

    await db
      .update(accounts)
      .set({ balance_cents: sql`${accounts.balance_cents} + ${delta}` })
      .where(eq(accounts.id, template.account_id))

    await db.insert(recurringGenerationLog).values({
      template_id: template.id,
      budget_sub_period_id: subPeriodId,
      scheduled_date: dateStr,
      transaction_id: txn.id,
      household_id: householdId,
    })

    loggedDates.add(dateStr)
    templateResult.generatedDates.push(dateStr)
    result.insertedCount++
  }

  result.templateResults.push(templateResult)
  return result
}
