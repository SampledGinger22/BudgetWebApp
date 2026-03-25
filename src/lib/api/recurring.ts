import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type {
  RecurringListResponse,
  PendingRecurringResponse,
  RecurringSuggestionsResponse,
  UnconfirmedCountResponse,
  RecurringTemplate,
  IdResponse,
} from './types'
import {
  createTemplateSchema,
  updateTemplateSchema,
  confirmSchema,
  bulkConfirmSchema,
} from '@/lib/validators/recurring'

// ─── Queries ─────────────────────────────────────────────────

export function useRecurringTemplates() {
  return useQuery({
    queryKey: queryKeys.recurring.list(),
    queryFn: () =>
      apiGet<RecurringListResponse>('/api/recurring'),
  })
}

export function usePendingEntries(accountId: number) {
  return useQuery({
    queryKey: queryKeys.recurring.pending(accountId),
    queryFn: () =>
      apiGet<PendingRecurringResponse>('/api/recurring/pending', { accountId }),
    enabled: !!accountId,
  })
}

export function useRecurringSuggestions() {
  return useQuery({
    queryKey: queryKeys.recurring.suggestions(),
    queryFn: () =>
      apiGet<RecurringSuggestionsResponse>('/api/recurring/suggestions'),
  })
}

export function useUnconfirmedCount() {
  return useQuery({
    queryKey: queryKeys.recurring.unconfirmedCount(),
    queryFn: () =>
      apiGet<UnconfirmedCountResponse>('/api/recurring/unconfirmed-count'),
  })
}

export function useRecurringHistory(id: number) {
  return useQuery({
    queryKey: queryKeys.recurring.history(id),
    queryFn: () =>
      apiGet<RecurringTemplate>(`/api/recurring/${id}/history`),
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateTemplateInput = z.infer<typeof createTemplateSchema>
type UpdateTemplateInput = z.infer<typeof updateTemplateSchema> & { id: number }
type ConfirmEntryInput = z.infer<typeof confirmSchema>
type BulkConfirmInput = z.infer<typeof bulkConfirmSchema>

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTemplateInput) =>
      apiPost<IdResponse>('/api/recurring', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.list() })
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTemplateInput) =>
      apiPatch<IdResponse>(`/api/recurring/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}

export function useToggleTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/recurring/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.list() })
    },
  })
}

export function useConfirmEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ConfirmEntryInput) =>
      apiPost<IdResponse>('/api/recurring/confirm', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useBulkConfirm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkConfirmInput) =>
      apiPost<void>('/api/recurring/bulk-confirm', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { fingerprint: string }) =>
      apiPost<void>('/api/recurring/dismiss-suggestion', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.suggestions() })
    },
  })
}

export function useSyncRecurring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<void>('/api/recurring/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}

export function useGenerateForTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<void>(`/api/recurring/${id}/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}
