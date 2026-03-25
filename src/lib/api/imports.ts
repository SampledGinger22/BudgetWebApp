import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type {
  ImportProfilesResponse,
  CheckDuplicatesResponse,
  CheckFitidResponse,
  IdResponse,
} from './types'
import {
  saveProfileSchema,
  updateProfileSchema,
  checkDuplicatesSchema,
  checkFitidSchema,
  commitImportSchema,
} from '@/lib/validators/imports'

// ─── Queries ─────────────────────────────────────────────────

export function useImportProfiles() {
  return useQuery({
    queryKey: queryKeys.imports.profiles(),
    queryFn: () =>
      apiGet<ImportProfilesResponse>('/api/imports/profiles'),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateProfileInput = z.infer<typeof saveProfileSchema>
type UpdateProfileInput = z.infer<typeof updateProfileSchema> & { id: number }
type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>
type CheckFitidInput = z.infer<typeof checkFitidSchema>
type CommitImportInput = z.infer<typeof commitImportSchema>

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProfileInput) =>
      apiPost<IdResponse>('/api/imports/profiles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.profiles() })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProfileInput) =>
      apiPatch<IdResponse>(`/api/imports/profiles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.profiles() })
    },
  })
}

export function useRenameProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiPatch<IdResponse>(`/api/imports/profiles/${id}/rename`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.profiles() })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/imports/profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.profiles() })
    },
  })
}

export function useCheckDuplicates() {
  return useMutation({
    mutationFn: (data: CheckDuplicatesInput) =>
      apiPost<CheckDuplicatesResponse>('/api/imports/check-duplicates', data),
  })
}

export function useCheckFitid() {
  return useMutation({
    mutationFn: (data: CheckFitidInput) =>
      apiPost<CheckFitidResponse>('/api/imports/check-fitid', data),
  })
}

export function useCommitImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CommitImportInput) =>
      apiPost<IdResponse>('/api/imports/commit', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
    },
  })
}
