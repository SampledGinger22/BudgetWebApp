import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type { Vendor, IdResponse } from './types'
import {
  createVendorSchema,
  updateVendorSchema,
} from '@/lib/validators/vendors'

// ─── Queries ─────────────────────────────────────────────────

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.vendors.list(),
    queryFn: () => apiGet<Vendor[]>('/api/vendors'),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateVendorInput = z.infer<typeof createVendorSchema>
type UpdateVendorInput = z.infer<typeof updateVendorSchema> & { id: number }

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateVendorInput) =>
      apiPost<IdResponse>('/api/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateVendorInput) =>
      apiPatch<IdResponse>(`/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    },
  })
}

export function useArchiveVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/vendors/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    },
  })
}

export function useDeleteVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<IdResponse>(`/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    },
  })
}
