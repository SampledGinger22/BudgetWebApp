# API Reference

> Complete route reference for PersonalBudget. All routes are Next.js App Router API handlers under `src/app/api/`.
>
> **Auth:** All routes require authentication via `requireAuth()` unless marked ✗. Authenticated routes return `401 Unauthorized` without a valid session. All data queries are scoped to the user's `household_id` (multi-tenant isolation).

---

## Accounts

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/accounts` | ✓ | List all accounts for the household |
| POST | `/api/accounts` | ✓ | Create a new account (checking, savings, credit card, etc.) |
| PATCH | `/api/accounts/[id]` | ✓ | Update an account's name, type, or other fields |
| DELETE | `/api/accounts/[id]` | ✓ | Delete an account permanently |
| POST | `/api/accounts/[id]/archive` | ✓ | Soft-archive an account (hides from active lists) |
| POST | `/api/accounts/[id]/unarchive` | ✓ | Restore an archived account |
| POST | `/api/accounts/reorder` | ✓ | Reorder accounts (update display_order) |

## Auth

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/auth/[...nextauth]` | ✗ | Auth.js handler — session, CSRF token, provider list |
| POST | `/api/auth/[...nextauth]` | ✗ | Auth.js handler — sign-in, sign-out, callback (rate limited: 10 req/60s per IP) |
| POST | `/api/auth/register` | ✗ | Register a new user with email + password (rate limited: 5 req/60s per IP) |

## Budget

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/budget/allocations` | ✓ | Create or update budget allocations for a period |
| POST | `/api/budget/close` | ✓ | Close a budget period (prevents further edits) |
| POST | `/api/budget/copy-allocations` | ✓ | Copy allocations from one period to another |
| POST | `/api/budget/lock` | ✓ | Lock a budget period (soft lock, can be unlocked) |
| GET | `/api/budget/periods-status` | ✓ | Get open/closed/locked status for all budget periods |
| POST | `/api/budget/reopen` | ✓ | Reopen a previously closed budget period |
| GET | `/api/budget/summary` | ✓ | Get budget summary with totals, remaining, and category breakdowns |
| GET | `/api/budget/transfers` | ✓ | List budget transfers between categories |
| POST | `/api/budget/transfers` | ✓ | Create a budget transfer between categories |
| POST | `/api/budget/transfers/[id]/reverse` | ✓ | Reverse a budget transfer |
| POST | `/api/budget/unlock` | ✓ | Unlock a previously locked budget period |
| GET | `/api/budget/variance` | ✓ | Get budget vs. actual variance report |

## Categories

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/categories` | ✓ | List all categories for the household |
| POST | `/api/categories` | ✓ | Create a new budget category |
| PATCH | `/api/categories/[id]` | ✓ | Update a category's name, group, or other fields |
| DELETE | `/api/categories/[id]` | ✓ | Delete a category permanently |
| POST | `/api/categories/[id]/archive` | ✓ | Soft-archive a category |
| POST | `/api/categories/[id]/unarchive` | ✓ | Restore an archived category |
| POST | `/api/categories/groups` | ✓ | Create or manage category groups |
| POST | `/api/categories/reorder` | ✓ | Reorder categories (update display_order) |

## Dashboard

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/dashboard` | ✓ | Get dashboard data (account balances, recent transactions, budget status) |

## Health

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/health` | ✗ | Unauthenticated health check — returns deployment status and DB connectivity. Returns 200 even when DB is unreachable (status: `degraded`). Used by Vercel health probes and uptime monitors. |

## Household

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/household` | ✓ | Get the current user's household details |
| GET | `/api/household/invite` | ✓ | List pending invitations for the household |
| POST | `/api/household/invite` | ✓ | Send an invitation to join the household |
| POST | `/api/household/invite/accept` | ✓ | Accept a household invitation |
| POST | `/api/household/invite/decline` | ✓ | Decline a household invitation (scoped by user email, not household_id) |
| GET | `/api/household/members` | ✓ | List household members (safe columns only — no password hashes) |

## Imports

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/imports/check-duplicates` | ✓ | Check imported transactions for duplicates against existing data |
| POST | `/api/imports/check-fitid` | ✓ | Check if FIT IDs (financial institution transaction IDs) already exist |
| POST | `/api/imports/commit` | ✓ | Commit staged import transactions to the database |
| GET | `/api/imports/profiles` | ✓ | List saved import profiles (column mappings) |
| POST | `/api/imports/profiles` | ✓ | Create a new import profile |
| PATCH | `/api/imports/profiles/[id]` | ✓ | Update an import profile's column mappings |
| DELETE | `/api/imports/profiles/[id]` | ✓ | Delete an import profile |
| PATCH | `/api/imports/profiles/[id]/rename` | ✓ | Rename an import profile |

## Members

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/members` | ✓ | List household members (budget assignment context) |
| POST | `/api/members` | ✓ | Add a household member |
| PATCH | `/api/members/[id]` | ✓ | Update a member's details |
| DELETE | `/api/members/[id]` | ✓ | Remove a member |
| POST | `/api/members/[id]/archive` | ✓ | Soft-archive a member |
| POST | `/api/members/[id]/unarchive` | ✓ | Restore an archived member |
| POST | `/api/members/reorder` | ✓ | Reorder members (update display_order) |

## Periods

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/periods` | ✓ | List all budget periods for the household |
| DELETE | `/api/periods/[id]` | ✓ | Delete a budget period |
| POST | `/api/periods/generate` | ✓ | Auto-generate budget periods from pay schedules |
| POST | `/api/periods/income-lines` | ✓ | Add an income line to a period |
| PATCH | `/api/periods/income-lines/[id]` | ✓ | Update an income line |
| DELETE | `/api/periods/income-lines/[id]` | ✓ | Delete an income line |
| POST | `/api/periods/pay-changes` | ✓ | Record a pay change (raise, job change, etc.) |
| PATCH | `/api/periods/pay-changes/[id]` | ✓ | Update a pay change record |
| DELETE | `/api/periods/pay-changes/[id]` | ✓ | Delete a pay change record |
| GET | `/api/periods/pay-history/[scheduleId]` | ✓ | Get pay history for a specific schedule |
| POST | `/api/periods/regenerate` | ✓ | Regenerate periods after schedule or pay changes |
| GET | `/api/periods/schedules` | ✓ | List all pay schedules |
| POST | `/api/periods/schedules` | ✓ | Create a new pay schedule |
| GET | `/api/periods/schedules/[id]` | ✓ | Get a specific pay schedule |
| PATCH | `/api/periods/schedules/[id]` | ✓ | Update a pay schedule |
| DELETE | `/api/periods/schedules/[id]` | ✓ | Delete a pay schedule |
| POST | `/api/periods/schedules/[id]/primary` | ✓ | Set a pay schedule as the primary schedule |
| PATCH | `/api/periods/sub-periods/[id]` | ✓ | Update a sub-period's date range or label |

## Reconciliation

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/reconciliation/balance` | ✓ | Get current reconciliation balance for an account |
| GET | `/api/reconciliation/history` | ✓ | Get reconciliation session history |
| GET | `/api/reconciliation/last-reconciled` | ✓ | Get the last reconciled date/balance for an account |
| POST | `/api/reconciliation/sessions` | ✓ | Start a new reconciliation session |
| GET | `/api/reconciliation/sessions/[id]` | ✓ | Get reconciliation session details |
| DELETE | `/api/reconciliation/sessions/[id]` | ✓ | Cancel/delete a reconciliation session |
| PUT | `/api/reconciliation/sessions/[id]/cleared` | ✓ | Update cleared transactions in a session |
| POST | `/api/reconciliation/sessions/[id]/finish` | ✓ | Finish (complete) a reconciliation session |
| POST | `/api/reconciliation/sessions/[id]/undo` | ✓ | Undo a completed reconciliation session |
| GET | `/api/reconciliation/unreconciled` | ✓ | Get unreconciled transactions for an account |

## Recurring

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/recurring` | ✓ | List all recurring transaction rules |
| POST | `/api/recurring` | ✓ | Create a new recurring transaction rule |
| PATCH | `/api/recurring/[id]` | ✓ | Update a recurring transaction rule |
| DELETE | `/api/recurring/[id]` | ✓ | Delete a recurring transaction rule |
| POST | `/api/recurring/[id]/generate` | ✓ | Manually generate transactions from a recurring rule |
| GET | `/api/recurring/[id]/history` | ✓ | Get generation history for a recurring rule |
| POST | `/api/recurring/[id]/toggle` | ✓ | Enable or disable a recurring rule |
| POST | `/api/recurring/bulk-confirm` | ✓ | Bulk-confirm multiple pending recurring transactions |
| POST | `/api/recurring/confirm` | ✓ | Confirm a single pending recurring transaction |
| POST | `/api/recurring/dismiss-suggestion` | ✓ | Dismiss a recurring transaction suggestion |
| GET | `/api/recurring/pending` | ✓ | Get pending (unconfirmed) recurring transactions |
| GET | `/api/recurring/suggestions` | ✓ | Get AI-detected recurring transaction suggestions |
| POST | `/api/recurring/sync` | ✓ | Sync recurring rules with actual transactions |
| GET | `/api/recurring/unconfirmed-count` | ✓ | Get count of unconfirmed recurring transactions |

## Settings

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/settings` | ✓ | Get all app settings for the household |
| POST | `/api/settings` | ✓ | Create or update a setting (upsert on compound key: `key` + `household_id`) |

## Transactions

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/transactions` | ✓ | List transactions with filtering, pagination, and sorting |
| POST | `/api/transactions` | ✓ | Create a new transaction |
| PATCH | `/api/transactions/[id]` | ✓ | Update a transaction |
| DELETE | `/api/transactions/[id]` | ✓ | Delete a transaction |
| GET | `/api/transactions/summary` | ✓ | Get transaction summary (totals by category, period, etc.) |

## Vendors

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/vendors` | ✓ | List all vendors for the household |
| POST | `/api/vendors` | ✓ | Create a new vendor |
| PATCH | `/api/vendors/[id]` | ✓ | Update a vendor |
| DELETE | `/api/vendors/[id]` | ✓ | Delete a vendor |
| POST | `/api/vendors/[id]/archive` | ✓ | Soft-archive a vendor |

---

## Route Statistics

| Metric | Value |
|--------|-------|
| Total routes | 83 |
| Authenticated routes | 80 |
| Public routes | 3 (`health`, `auth/register`, `auth/[...nextauth]`) |
| Rate-limited routes | 2 (`auth/register`: 5/60s, `auth/[...nextauth]` POST: 10/60s) |
| Domains | 14 (accounts, auth, budget, categories, dashboard, health, household, imports, members, periods, reconciliation, recurring, settings, transactions) + vendors |

## Security Model

- **Authentication:** All routes (except 3 public) call `requireAuth()` which validates the session and returns the user's `householdId`.
- **Tenant Isolation:** Every database query includes `household_id` scoping. Two households cannot see each other's data.
- **Input Validation:** All mutation routes validate input with Zod schemas. Archive/toggle routes validate the URL `[id]` parameter manually.
- **Rate Limiting:** Auth endpoints are rate-limited per IP using an in-memory fixed-window algorithm. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.
- **Password Security:** Registration uses bcrypt with a server-side pepper (`PEPPER_SECRET`). Email is lowercased. Error messages are generic to prevent user enumeration.

## Common Response Shapes

### Success (list)
```json
{ "data": [...] }
```

### Success (single)
```json
{ "data": { ... } }
```

### Error
```json
{ "error": "Human-readable error message" }
```

### Rate Limited (429)
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 42
}
```
