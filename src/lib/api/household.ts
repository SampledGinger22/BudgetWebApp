import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from './client'
import { queryKeys } from './query-keys'
import type { Household, HouseholdUser, HouseholdInvite, IdResponse } from './types'

// ─── Queries ─────────────────────────────────────────────────

export function useHousehold() {
  return useQuery({
    queryKey: queryKeys.household.info(),
    queryFn: () => apiGet<Household>('/api/household'),
  })
}

export function useHouseholdMembers() {
  return useQuery({
    queryKey: queryKeys.household.members(),
    queryFn: () => apiGet<HouseholdUser[]>('/api/household/members'),
  })
}

export function useHouseholdInvites() {
  return useQuery({
    queryKey: queryKeys.household.invites(),
    queryFn: () => apiGet<HouseholdInvite[]>('/api/household/invite'),
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useSendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string }) =>
      apiPost<IdResponse>('/api/household/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.household.invites() })
    },
  })
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { invite_id: number }) =>
      apiPost<void>('/api/household/invite/accept', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.household.all })
    },
  })
}

export function useDeclineInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { invite_id: number }) =>
      apiPost<void>('/api/household/invite/decline', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.household.invites() })
    },
  })
}
