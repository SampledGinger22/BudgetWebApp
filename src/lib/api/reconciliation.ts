import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type {
  ReconciliationBalanceResponse,
  Transaction,
  LastReconciledEntry,
  ReconciliationSession,
  IdResponse,
} from './types'
import {
  startSessionSchema,
  updateClearedSchema,
} from '@/lib/validators/reconciliation'

// ─── Queries ─────────────────────────────────────────────────

export function useReconBalance(accountId: number) {
  return useQuery({
    queryKey: queryKeys.reconciliation.balance(accountId),
    queryFn: () =>
      apiGet<ReconciliationBalanceResponse>('/api/reconciliation/balance', { accountId }),
    enabled: !!accountId,
  })
}

export function useUnreconciledTransactions(accountId: number, statementDate: string) {
  return useQuery({
    queryKey: queryKeys.reconciliation.unreconciled(accountId, statementDate),
    queryFn: () =>
      apiGet<Transaction[]>('/api/reconciliation/unreconciled', { accountId, statementDate }),
    enabled: !!accountId && !!statementDate,
  })
}

export function useLastReconciledDates() {
  return useQuery({
    queryKey: queryKeys.reconciliation.lastReconciled(),
    queryFn: () =>
      apiGet<LastReconciledEntry[]>('/api/reconciliation/last-reconciled'),
  })
}

export function useReconHistory(accountId: number) {
  return useQuery({
    queryKey: queryKeys.reconciliation.history(accountId),
    queryFn: () =>
      apiGet<ReconciliationSession[]>('/api/reconciliation/history', { accountId }),
    enabled: !!accountId,
  })
}

export function useReconSession(id: number) {
  return useQuery({
    queryKey: queryKeys.reconciliation.session(id),
    queryFn: () =>
      apiGet<ReconciliationSession>(`/api/reconciliation/sessions/${id}`),
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

type StartReconSessionInput = z.infer<typeof startSessionSchema>
type UpdateClearedInput = z.infer<typeof updateClearedSchema> & { sessionId: number }

export function useStartReconSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: StartReconSessionInput) =>
      apiPost<IdResponse>('/api/reconciliation/sessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
    },
  })
}

export function useUpdateCleared() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...data }: UpdateClearedInput) =>
      apiPut<void>(`/api/reconciliation/sessions/${sessionId}/cleared`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.session(variables.sessionId),
      })
    },
  })
}

export function useFinishReconSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<void>(`/api/reconciliation/sessions/${id}/finish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
    },
  })
}

export function useUndoReconSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<void>(`/api/reconciliation/sessions/${id}/undo`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
    },
  })
}

export function useCancelReconSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/reconciliation/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
    },
  })
}
