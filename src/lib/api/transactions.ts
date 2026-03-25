import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type {
  TransactionsListResponse,
  TransactionsSummaryResponse,
  TransactionCreateResponse,
  IdResponse,
} from './types'
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/lib/validators/transactions'

// ─── Queries ─────────────────────────────────────────────────

export function useTransactions(params: {
  accountId: number
  subPeriodId?: number
  page?: number
  pageSize?: number
  [key: string]: string | number | boolean | undefined
}) {
  return useQuery({
    queryKey: queryKeys.transactions.list(params),
    queryFn: () =>
      apiGet<TransactionsListResponse>('/api/transactions', params),
    enabled: !!params.accountId,
  })
}

export function useTransactionSummary(params: {
  accountId: number
  subPeriodId?: number
  [key: string]: string | number | boolean | undefined
}) {
  return useQuery({
    queryKey: queryKeys.transactions.summary(params),
    queryFn: () =>
      apiGet<TransactionsSummaryResponse>('/api/transactions/summary', params),
    enabled: !!params.accountId,
  })
}

// ─── Invalidation helper ─────────────────────────────────────

/** Transaction mutations affect many domains — centralize the invalidation list */
function invalidateTransactionCascade(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.recurring.unconfirmedCount() })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateTransactionInput = z.infer<typeof createTransactionSchema>
type UpdateTransactionInput = z.infer<typeof updateTransactionSchema> & { id: number }

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTransactionInput) =>
      apiPost<TransactionCreateResponse>('/api/transactions', data),
    onSuccess: () => {
      invalidateTransactionCascade(queryClient)
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTransactionInput) =>
      apiPatch<IdResponse>(`/api/transactions/${id}`, data),
    onSuccess: () => {
      invalidateTransactionCascade(queryClient)
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/transactions/${id}`),
    onSuccess: () => {
      invalidateTransactionCascade(queryClient)
    },
  })
}
