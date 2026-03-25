import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type { HouseholdMember, IdResponse } from './types'
import {
  createMemberSchema,
  updateMemberSchema,
  reorderMembersSchema,
} from '@/lib/validators/members'

// ─── Queries ─────────────────────────────────────────────────

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members.list(),
    queryFn: () => apiGet<HouseholdMember[]>('/api/members'),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateMemberInput = z.infer<typeof createMemberSchema>
type UpdateMemberInput = z.infer<typeof updateMemberSchema> & { id: number }
type ReorderMembersInput = z.infer<typeof reorderMembersSchema>

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMemberInput) =>
      apiPost<IdResponse>('/api/members', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMemberInput) =>
      apiPatch<IdResponse>(`/api/members/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useArchiveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/members/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useUnarchiveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/members/${id}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<IdResponse>(`/api/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}

export function useReorderMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderMembersInput) =>
      apiPost<void>('/api/members/reorder', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    },
  })
}
