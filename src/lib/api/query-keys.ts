/**
 * TanStack Query key factory — one namespace per API domain.
 *
 * Conventions:
 *   - `.all` invalidates the entire domain
 *   - `.list(params?)` includes filter params for granular cache hits
 *   - Named keys match specific GET endpoints
 */
export const queryKeys = {
  // ─── Accounts ────────────────────────────────────────────────
  accounts: {
    all: ['accounts'] as const,
    list: (params?: { includeArchived?: boolean }) =>
      ['accounts', 'list', params] as const,
    detail: (id: number) => ['accounts', 'detail', { id }] as const,
  },

  // ─── Budget ──────────────────────────────────────────────────
  budget: {
    all: ['budget'] as const,
    variance: (subPeriodId: number) =>
      ['budget', 'variance', { subPeriodId }] as const,
    summary: (subPeriodId: number) =>
      ['budget', 'summary', { subPeriodId }] as const,
    periodsStatus: () => ['budget', 'periods-status'] as const,
    transfers: (subPeriodId: number) =>
      ['budget', 'transfers', { subPeriodId }] as const,
  },

  // ─── Categories ──────────────────────────────────────────────
  categories: {
    all: ['categories'] as const,
    list: (params?: { includeArchived?: boolean }) =>
      ['categories', 'list', params] as const,
    detail: (id: number) => ['categories', 'detail', { id }] as const,
  },

  // ─── Dashboard ───────────────────────────────────────────────
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
  },

  // ─── Household ───────────────────────────────────────────────
  household: {
    all: ['household'] as const,
    info: () => ['household', 'info'] as const,
    members: () => ['household', 'members'] as const,
    invites: () => ['household', 'invites'] as const,
  },

  // ─── Imports ─────────────────────────────────────────────────
  imports: {
    all: ['imports'] as const,
    profiles: () => ['imports', 'profiles'] as const,
    profileDetail: (id: number) => ['imports', 'profile', { id }] as const,
  },

  // ─── Members (household members for tagging) ────────────────
  members: {
    all: ['members'] as const,
    list: (params?: { includeArchived?: boolean }) =>
      ['members', 'list', params] as const,
    detail: (id: number) => ['members', 'detail', { id }] as const,
  },

  // ─── Periods ─────────────────────────────────────────────────
  periods: {
    all: ['periods'] as const,
    list: () => ['periods', 'list'] as const,
    detail: (id: number) => ['periods', 'detail', { id }] as const,
    schedules: () => ['periods', 'schedules'] as const,
    scheduleDetail: (id: number) =>
      ['periods', 'schedule', { id }] as const,
    payHistory: (scheduleId: number) =>
      ['periods', 'pay-history', { scheduleId }] as const,
  },

  // ─── Reconciliation ─────────────────────────────────────────
  reconciliation: {
    all: ['reconciliation'] as const,
    balance: (accountId: number) =>
      ['reconciliation', 'balance', { accountId }] as const,
    history: (accountId: number) =>
      ['reconciliation', 'history', { accountId }] as const,
    lastReconciled: () => ['reconciliation', 'last-reconciled'] as const,
    unreconciled: (accountId: number, statementDate: string) =>
      ['reconciliation', 'unreconciled', { accountId, statementDate }] as const,
    session: (id: number) =>
      ['reconciliation', 'session', { id }] as const,
  },

  // ─── Recurring ───────────────────────────────────────────────
  recurring: {
    all: ['recurring'] as const,
    list: () => ['recurring', 'list'] as const,
    detail: (id: number) => ['recurring', 'detail', { id }] as const,
    history: (id: number) => ['recurring', 'history', { id }] as const,
    pending: (accountId: number) =>
      ['recurring', 'pending', { accountId }] as const,
    suggestions: () => ['recurring', 'suggestions'] as const,
    unconfirmedCount: () => ['recurring', 'unconfirmed-count'] as const,
  },

  // ─── Settings ────────────────────────────────────────────────
  settings: {
    all: ['settings'] as const,
    byKey: (key: string) => ['settings', { key }] as const,
  },

  // ─── Transactions ────────────────────────────────────────────
  transactions: {
    all: ['transactions'] as const,
    list: (params: {
      accountId: number
      subPeriodId?: number
      page?: number
      pageSize?: number
      [key: string]: string | number | boolean | undefined
    }) => ['transactions', 'list', params] as const,
    summary: (params: {
      accountId: number
      subPeriodId?: number
      [key: string]: string | number | boolean | undefined
    }) => ['transactions', 'summary', params] as const,
    detail: (id: number) => ['transactions', 'detail', { id }] as const,
  },

  // ─── Vendors ─────────────────────────────────────────────────
  vendors: {
    all: ['vendors'] as const,
    list: (params?: { includeArchived?: boolean }) =>
      ['vendors', 'list', params] as const,
    detail: (id: number) => ['vendors', 'detail', { id }] as const,
  },
} as const
