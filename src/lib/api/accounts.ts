import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type { Account, IdResponse } from './types'
import {
  createAccountSchema,
  updateAccountSchema,
  reorderSchema,
} from '@/lib/validators/accounts'

// ─── Queries ─────────────────────────────────────────────────

export function useAccounts(params?: { includeArchived?: boolean }) {
  return useQuery({
    queryKey: queryKeys.accounts.list(params),
    queryFn: () =>
      apiGet<Account[]>('/api/accounts', params),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateAccountInput = z.infer<typeof createAccountSchema>
type UpdateAccountInput = z.infer<typeof updateAccountSchema> & { id: number }
type ReorderAccountsInput = z.infer<typeof reorderSchema>

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAccountInput) =>
      apiPost<IdResponse>('/api/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAccountInput) =>
      apiPatch<IdResponse>(`/api/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useArchiveAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/accounts/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useUnarchiveAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/accounts/${id}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<IdResponse>(`/api/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
  })
}

export function useReorderAccounts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderAccountsInput) =>
      apiPost<void>('/api/accounts/reorder', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
    },
  })
}
