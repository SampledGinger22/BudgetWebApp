import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost } from './client'
import { queryKeys } from './query-keys'
import type {
  BudgetVarianceResponse,
  BudgetSummaryResponse,
  BudgetPeriodsStatusResponse,
  BudgetTransfersResponse,
  AllocationResponse,
  TransferCreateResponse,
  IdResponse,
} from './types'
import {
  upsertAllocationSchema,
  createTransferSchema,
  copyAllocationsSchema,
} from '@/lib/validators/budget'

// ─── Queries ─────────────────────────────────────────────────

export function useBudgetVariance(subPeriodId: number) {
  return useQuery({
    queryKey: queryKeys.budget.variance(subPeriodId),
    queryFn: () =>
      apiGet<BudgetVarianceResponse>('/api/budget/variance', { subPeriodId }),
    enabled: !!subPeriodId,
  })
}

export function useBudgetSummary(subPeriodId: number) {
  return useQuery({
    queryKey: queryKeys.budget.summary(subPeriodId),
    queryFn: () =>
      apiGet<BudgetSummaryResponse>('/api/budget/summary', { subPeriodId }),
    enabled: !!subPeriodId,
  })
}

export function useBudgetPeriodsStatus() {
  return useQuery({
    queryKey: queryKeys.budget.periodsStatus(),
    queryFn: () =>
      apiGet<BudgetPeriodsStatusResponse>('/api/budget/periods-status'),
  })
}

export function useBudgetTransfers(subPeriodId: number) {
  return useQuery({
    queryKey: queryKeys.budget.transfers(subPeriodId),
    queryFn: () =>
      apiGet<BudgetTransfersResponse>('/api/budget/transfers', { subPeriodId }),
    enabled: !!subPeriodId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

type AllocateBudgetInput = z.infer<typeof upsertAllocationSchema>
type CreateTransferInput = z.infer<typeof createTransferSchema>
type CopyAllocationsInput = z.infer<typeof copyAllocationsSchema>

export function useAllocateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AllocateBudgetInput) =>
      apiPost<AllocationResponse>('/api/budget/allocations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTransferInput) =>
      apiPost<TransferCreateResponse>('/api/budget/transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useReverseTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<TransferCreateResponse>(`/api/budget/transfers/${id}/reverse`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useCopyAllocations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CopyAllocationsInput) =>
      apiPost<void>('/api/budget/copy-allocations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useClosePeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { subPeriodId: number }) =>
      apiPost<void>('/api/budget/close', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useReopenPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { subPeriodId: number }) =>
      apiPost<void>('/api/budget/reopen', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useLockPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { subPeriodId: number }) =>
      apiPost<void>('/api/budget/lock', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.periodsStatus() })
    },
  })
}

export function useUnlockPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { subPeriodId: number }) =>
      apiPost<void>('/api/budget/unlock', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}
