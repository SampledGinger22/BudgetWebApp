/**
 * Client-side response type interfaces for all GET endpoints.
 *
 * These are lightweight interfaces derived from route file return shapes.
 * They must NOT import from server-only schema modules.
 *
 * Organized by API domain.
 */

// ─── Accounts ────────────────────────────────────────────────

export interface Account {
  id: number
  name: string
  type: 'checking' | 'savings' | 'credit' | 'student_loan' | 'standard_loan'
  opening_balance_cents: number
  balance_cents: number
  as_of_date: string | null
  credit_limit_cents: number | null
  interest_rate_basis_points: number | null
  minimum_payment_cents: number | null
  statement_date: number | null
  interest_date: number | null
  sort_order: number
  archived_at: string | null
  created_at: string
  household_id: number
}

// ─── Budget ──────────────────────────────────────────────────

export interface BudgetMemberSpend {
  member_id: number
  member_name: string | null
  member_initials: string | null
  spent_cents: number
}

export interface BudgetVarianceRow {
  category_id: number
  category_name: string
  parent_id: number | null
  category_group_id: number
  category_group_name: string
  group_sort_order: number
  category_sort_order: number
  initial_budget_cents: number
  net_transfers_cents: number
  income_cents: number
  total_spent_cents: number
  remaining_cents: number
  expected_cents: number
  member_spend: BudgetMemberSpend[]
}

export interface BudgetVarianceResponse {
  data: BudgetVarianceRow[]
}

export interface BudgetSummaryResponse {
  total_income_cents: number
  carry_forward_cents: number
  total_allocated_cents: number
  total_spent_cents: number
  total_remaining_cents: number
}

export interface BudgetPeriodStatus {
  id: number
  budget_period_id: number
  start_date: string
  end_date: string
  surplus_carry_forward_cents: number
  sort_order: number
  is_carry_only: number
  created_at: string
  period_start_date: string
  period_end_date: string
  pay_schedule_id: number | null
  is_closed: boolean
  is_locked: boolean
  closed_at: string | null
  locked_at: string | null
  needs_close: boolean
}

export interface BudgetPeriodsStatusResponse {
  data: BudgetPeriodStatus[]
}

export interface BudgetTransfer {
  id: number
  budget_sub_period_id: number
  from_category_id: number
  to_category_id: number
  amount_cents: number
  note: string | null
  from_category_name: string
  to_category_name: string
  reversal_of_id: number | null
  created_at: string
  household_id: number
  has_been_reversed: boolean
  is_reversal: boolean
}

export interface BudgetTransfersResponse {
  data: BudgetTransfer[]
}

export interface AllocationResponse {
  id: number
  allocated_cents: number
  was_clamped: boolean
}

export interface TransferCreateResponse {
  id: number
  amount_cents: number
  was_capped: boolean
}

// ─── Categories ──────────────────────────────────────────────

export interface Category {
  id: number
  category_group_id: number
  parent_id: number | null
  name: string
  ref_number: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
  household_id: number
}

export interface CategoryWithSubs extends Category {
  sub_categories: Category[]
}

export interface CategoryGroup {
  id: number
  name: string
  color: string | null
  sort_order: number
  created_at: string
  household_id: number
  categories: CategoryWithSubs[]
}

// ─── Dashboard ───────────────────────────────────────────────

export interface DashboardAccount {
  id: number
  name: string
  type: string
  balance_cents: number
  archived_at: string | null
}

export interface DashboardTotals {
  checking: number
  savings: number
  credit: number
  student_loan: number
  standard_loan: number
  net: number
}

export interface DashboardResponse {
  accounts: DashboardAccount[]
  totals: DashboardTotals
}

// ─── Household ───────────────────────────────────────────────

export interface Household {
  id: number
  name: string
  max_members: number
  owner_id: string
  member_count: number
  created_at: string
}

export interface HouseholdUser {
  id: string
  email: string
  name: string | null
  is_owner: boolean
}

export interface HouseholdInvite {
  id: number
  household_name: string
  invited_by_name: string | null
  created_at: string
}

// ─── Imports ─────────────────────────────────────────────────

export interface ImportProfile {
  id: number
  name: string
  header_fingerprint: string
  mapping_json: string
  created_at: string
  household_id: number
}

export interface ImportProfilesResponse {
  data: ImportProfile[]
}

export interface CheckDuplicatesResponse {
  duplicates: boolean[]
}

export interface CheckFitidResponse {
  exists: boolean
}

// ─── Members (household members for tagging) ────────────────

export interface HouseholdMember {
  id: number
  name: string
  initials: string
  color: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
  household_id: number
}

// ─── Periods ─────────────────────────────────────────────────

export interface PeriodIncomeLine {
  id: number
  budget_sub_period_id: number
  label: string
  expected_cents: number
  actual_cents: number | null
  category_id: number | null
  sort_order: number
  created_at: string
  household_id: number
}

export interface BudgetSubPeriod {
  id: number
  budget_period_id: number
  start_date: string
  end_date: string
  surplus_carry_forward_cents: number
  sort_order: number
  is_carry_only: number
  closed_at: string | null
  locked_at: string | null
  created_at: string
  household_id: number
  income_lines: PeriodIncomeLine[]
}

export interface BudgetPeriod {
  id: number
  pay_schedule_id: number | null
  start_date: string
  end_date: string
  created_at: string
  household_id: number
  sub_periods: BudgetSubPeriod[]
}

export interface PeriodsListResponse {
  data: BudgetPeriod[]
}

export interface PaySchedule {
  id: number
  name: string
  schedule_type: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  day_of_month_1: number | null
  day_of_month_2: number | null
  day_of_week: number | null
  anchor_date: string | null
  is_primary: number
  amount_cents: number | null
  household_member_id: number | null
  income_category_id: number | null
  vendor_id: number | null
  end_date: string | null
  recurring_template_id: number | null
  created_at: string
  household_id: number
}

export interface PaySchedulesResponse {
  data: PaySchedule[]
}

export interface PayHistoryEntry {
  id: number
  pay_schedule_id: number
  effective_date: string
  amount_cents: number
  notes: string | null
  created_at: string
  household_id: number
}

// ─── Reconciliation ─────────────────────────────────────────

export interface ReconciliationSession {
  id: number
  account_id: number
  statement_date: string
  statement_balance_cents: number
  status: 'in_progress' | 'completed'
  cleared_transaction_ids: string
  completed_at: string | null
  created_at: string
  household_id: number
}

export interface ReconciliationBalanceResponse {
  reconciled_balance_cents: number
  balance_cents: number
  unreconciled_delta_cents: number
}

export interface LastReconciledEntry {
  account_id: number
  last_statement_date: string
  last_completed_at: string
}

// ─── Recurring ───────────────────────────────────────────────

export interface RecurringTemplateDate {
  day_value: number
  sort_order: number
}

export interface RecurringTemplate {
  id: number
  name: string
  vendor_id: number | null
  amount_cents: number
  is_debit: number
  category_id: number | null
  account_id: number | null
  member_id: number | null
  type: string
  frequency: string
  interval_n: number
  start_date: string
  end_date: string | null
  status: 'active' | 'paused'
  auto_confirm: number
  notes: string | null
  created_at: string
  vendor_name: string | null
  category_name: string | null
  account_name: string | null
  member_name: string | null
  template_dates: RecurringTemplateDate[]
  next_date: string | null
}

export interface RecurringListResponse {
  data: RecurringTemplate[]
}

export interface PendingRecurringEntry {
  template_id: number
  template_name: string
  date: string
  amount_cents: number
  is_debit: number
  category: string | null
  vendor: string | null
  member: string | null
  status: 'past_due' | 'due_today' | 'upcoming'
}

export interface PendingRecurringResponse {
  data: PendingRecurringEntry[]
}

export interface RecurringSuggestion {
  description: string
  count: number
  avg_amount_cents: number
  min_amount_cents: number
  max_amount_cents: number
  is_debit: number
  account_id: number
  category_id: number | null
  vendor_id: number | null
  fingerprint: string
}

export interface RecurringSuggestionsResponse {
  data: RecurringSuggestion[]
}

export interface UnconfirmedCountResponse {
  count: number
}

// ─── Settings ────────────────────────────────────────────────

export interface SettingValue {
  key: string
  value: string | null
}

// ─── Transactions ────────────────────────────────────────────

export interface Transaction {
  id: number
  account_id: number
  budget_sub_period_id: number | null
  date: string
  description: string
  original_description: string | null
  amount_cents: number
  is_debit: number
  category_id: number | null
  vendor_id: number | null
  member_id: number | null
  recurring_template_id: number | null
  recurring_status: string | null
  estimated_amount_cents: number | null
  fitid: string | null
  import_batch_id: string | null
  reconciled_at: string | null
  voided_at: string | null
  created_at: string
  household_id: number
}

export interface TransactionRow extends Transaction {
  running_balance_cents: number | null
}

export interface TransactionsListResponse {
  data: TransactionRow[]
  totalCount: number
  page?: number
  pageSize?: number
}

export interface TransactionsSummaryResponse {
  balance_cents: number
  income_cents: number
  expense_cents: number
  count: number
}

export interface TransactionCreateResponse {
  id: number
  budget_sub_period_id: number | null
}

// ─── Vendors ─────────────────────────────────────────────────

export interface Vendor {
  id: number
  name: string
  default_category_id: number | null
  default_category_name: string | null
  type: string | null
  archived_at: string | null
  created_at: string
  household_id: number
}

// ─── Generic API Error ───────────────────────────────────────

export interface ApiErrorResponse {
  error: string
  details?: unknown
}

// ─── Mutation Responses (common) ─────────────────────────────

export interface IdResponse {
  id: number
}

export interface CategoryCreateResponse {
  id: number
  ref_number: string | null
}
