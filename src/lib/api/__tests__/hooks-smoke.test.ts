import { describe, it, expect } from 'vitest'

// Domain hooks — accounts
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useArchiveAccount,
  useUnarchiveAccount,
  useDeleteAccount,
  useReorderAccounts,
} from '../accounts'

// Domain hooks — budget
import {
  useBudgetVariance,
  useBudgetSummary,
  useBudgetPeriodsStatus,
  useBudgetTransfers,
  useAllocateBudget,
  useCreateTransfer,
  useReverseTransfer,
  useCopyAllocations,
  useClosePeriod,
  useReopenPeriod,
  useLockPeriod,
  useUnlockPeriod,
} from '../budget'

// Domain hooks — categories
import {
  useCategories,
  useCreateCategoryGroup,
  useCreateCategory,
  useUpdateCategory,
  useArchiveCategory,
  useUnarchiveCategory,
  useDeleteCategory,
  useReorderCategories,
} from '../categories'

// Domain hooks — dashboard
import { useDashboard } from '../dashboard'

// Domain hooks — household
import {
  useHousehold,
  useHouseholdMembers,
  useHouseholdInvites,
  useSendInvite,
  useAcceptInvite,
  useDeclineInvite,
} from '../household'

// Domain hooks — imports
import {
  useImportProfiles,
  useCreateProfile,
  useUpdateProfile,
  useRenameProfile,
  useDeleteProfile,
  useCheckDuplicates,
  useCheckFitid,
  useCommitImport,
} from '../imports'

// Domain hooks — members
import {
  useMembers,
  useCreateMember,
  useUpdateMember,
  useArchiveMember,
  useUnarchiveMember,
  useDeleteMember,
  useReorderMembers,
} from '../members'

// Domain hooks — periods
import {
  usePeriods,
  useSchedules,
  useSchedule,
  usePayHistory,
  useGeneratePeriods,
  useRegeneratePeriods,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useSetPrimarySchedule,
  useUpdateSubPeriod,
  useDeletePeriod,
  useAddIncomeLine,
  useUpdateIncomeLine,
  useDeleteIncomeLine,
  useAddPayChange,
  useUpdatePayChange,
  useDeletePayChange,
} from '../periods'

// Domain hooks — reconciliation
import {
  useReconBalance,
  useUnreconciledTransactions,
  useLastReconciledDates,
  useReconHistory,
  useReconSession,
  useStartReconSession,
  useUpdateCleared,
  useFinishReconSession,
  useUndoReconSession,
  useCancelReconSession,
} from '../reconciliation'

// Domain hooks — recurring
import {
  useRecurringTemplates,
  usePendingEntries,
  useRecurringSuggestions,
  useUnconfirmedCount,
  useRecurringHistory,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useToggleTemplate,
  useConfirmEntry,
  useBulkConfirm,
  useDismissSuggestion,
  useSyncRecurring,
  useGenerateForTemplate,
} from '../recurring'

// Domain hooks — settings
import { useSetting, useUpdateSetting } from '../settings'

// Domain hooks — transactions
import {
  useTransactions,
  useTransactionSummary,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '../transactions'

// Domain hooks — vendors
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useArchiveVendor,
  useDeleteVendor,
} from '../vendors'

// Zustand stores
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'

describe('accounts hooks', () => {
  it.each([
    ['useAccounts', useAccounts],
    ['useCreateAccount', useCreateAccount],
    ['useUpdateAccount', useUpdateAccount],
    ['useArchiveAccount', useArchiveAccount],
    ['useUnarchiveAccount', useUnarchiveAccount],
    ['useDeleteAccount', useDeleteAccount],
    ['useReorderAccounts', useReorderAccounts],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('budget hooks', () => {
  it.each([
    ['useBudgetVariance', useBudgetVariance],
    ['useBudgetSummary', useBudgetSummary],
    ['useBudgetPeriodsStatus', useBudgetPeriodsStatus],
    ['useBudgetTransfers', useBudgetTransfers],
    ['useAllocateBudget', useAllocateBudget],
    ['useCreateTransfer', useCreateTransfer],
    ['useReverseTransfer', useReverseTransfer],
    ['useCopyAllocations', useCopyAllocations],
    ['useClosePeriod', useClosePeriod],
    ['useReopenPeriod', useReopenPeriod],
    ['useLockPeriod', useLockPeriod],
    ['useUnlockPeriod', useUnlockPeriod],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('categories hooks', () => {
  it.each([
    ['useCategories', useCategories],
    ['useCreateCategoryGroup', useCreateCategoryGroup],
    ['useCreateCategory', useCreateCategory],
    ['useUpdateCategory', useUpdateCategory],
    ['useArchiveCategory', useArchiveCategory],
    ['useUnarchiveCategory', useUnarchiveCategory],
    ['useDeleteCategory', useDeleteCategory],
    ['useReorderCategories', useReorderCategories],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('dashboard hooks', () => {
  it('useDashboard is a function', () => {
    expect(typeof useDashboard).toBe('function')
  })
})

describe('household hooks', () => {
  it.each([
    ['useHousehold', useHousehold],
    ['useHouseholdMembers', useHouseholdMembers],
    ['useHouseholdInvites', useHouseholdInvites],
    ['useSendInvite', useSendInvite],
    ['useAcceptInvite', useAcceptInvite],
    ['useDeclineInvite', useDeclineInvite],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('imports hooks', () => {
  it.each([
    ['useImportProfiles', useImportProfiles],
    ['useCreateProfile', useCreateProfile],
    ['useUpdateProfile', useUpdateProfile],
    ['useRenameProfile', useRenameProfile],
    ['useDeleteProfile', useDeleteProfile],
    ['useCheckDuplicates', useCheckDuplicates],
    ['useCheckFitid', useCheckFitid],
    ['useCommitImport', useCommitImport],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('members hooks', () => {
  it.each([
    ['useMembers', useMembers],
    ['useCreateMember', useCreateMember],
    ['useUpdateMember', useUpdateMember],
    ['useArchiveMember', useArchiveMember],
    ['useUnarchiveMember', useUnarchiveMember],
    ['useDeleteMember', useDeleteMember],
    ['useReorderMembers', useReorderMembers],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('periods hooks', () => {
  it.each([
    ['usePeriods', usePeriods],
    ['useSchedules', useSchedules],
    ['useSchedule', useSchedule],
    ['usePayHistory', usePayHistory],
    ['useGeneratePeriods', useGeneratePeriods],
    ['useRegeneratePeriods', useRegeneratePeriods],
    ['useCreateSchedule', useCreateSchedule],
    ['useUpdateSchedule', useUpdateSchedule],
    ['useDeleteSchedule', useDeleteSchedule],
    ['useSetPrimarySchedule', useSetPrimarySchedule],
    ['useUpdateSubPeriod', useUpdateSubPeriod],
    ['useDeletePeriod', useDeletePeriod],
    ['useAddIncomeLine', useAddIncomeLine],
    ['useUpdateIncomeLine', useUpdateIncomeLine],
    ['useDeleteIncomeLine', useDeleteIncomeLine],
    ['useAddPayChange', useAddPayChange],
    ['useUpdatePayChange', useUpdatePayChange],
    ['useDeletePayChange', useDeletePayChange],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('reconciliation hooks', () => {
  it.each([
    ['useReconBalance', useReconBalance],
    ['useUnreconciledTransactions', useUnreconciledTransactions],
    ['useLastReconciledDates', useLastReconciledDates],
    ['useReconHistory', useReconHistory],
    ['useReconSession', useReconSession],
    ['useStartReconSession', useStartReconSession],
    ['useUpdateCleared', useUpdateCleared],
    ['useFinishReconSession', useFinishReconSession],
    ['useUndoReconSession', useUndoReconSession],
    ['useCancelReconSession', useCancelReconSession],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('recurring hooks', () => {
  it.each([
    ['useRecurringTemplates', useRecurringTemplates],
    ['usePendingEntries', usePendingEntries],
    ['useRecurringSuggestions', useRecurringSuggestions],
    ['useUnconfirmedCount', useUnconfirmedCount],
    ['useRecurringHistory', useRecurringHistory],
    ['useCreateTemplate', useCreateTemplate],
    ['useUpdateTemplate', useUpdateTemplate],
    ['useDeleteTemplate', useDeleteTemplate],
    ['useToggleTemplate', useToggleTemplate],
    ['useConfirmEntry', useConfirmEntry],
    ['useBulkConfirm', useBulkConfirm],
    ['useDismissSuggestion', useDismissSuggestion],
    ['useSyncRecurring', useSyncRecurring],
    ['useGenerateForTemplate', useGenerateForTemplate],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('settings hooks', () => {
  it.each([
    ['useSetting', useSetting],
    ['useUpdateSetting', useUpdateSetting],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('transactions hooks', () => {
  it.each([
    ['useTransactions', useTransactions],
    ['useTransactionSummary', useTransactionSummary],
    ['useCreateTransaction', useCreateTransaction],
    ['useUpdateTransaction', useUpdateTransaction],
    ['useDeleteTransaction', useDeleteTransaction],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('vendors hooks', () => {
  it.each([
    ['useVendors', useVendors],
    ['useCreateVendor', useCreateVendor],
    ['useUpdateVendor', useUpdateVendor],
    ['useArchiveVendor', useArchiveVendor],
    ['useDeleteVendor', useDeleteVendor],
  ])('%s is a function', (_, hook) => {
    expect(typeof hook).toBe('function')
  })
})

describe('zustand stores', () => {
  it('useAuthStore is a function', () => {
    expect(typeof useAuthStore).toBe('function')
  })

  it('useUIStore is a function', () => {
    expect(typeof useUIStore).toBe('function')
  })
})
