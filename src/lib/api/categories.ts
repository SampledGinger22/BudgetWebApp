import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type { CategoryGroup, IdResponse, CategoryCreateResponse } from './types'
import {
  createGroupSchema,
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from '@/lib/validators/categories'

// ─── Queries ─────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: () => apiGet<CategoryGroup[]>('/api/categories'),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type CreateGroupInput = z.infer<typeof createGroupSchema>
type CreateCategoryInput = z.infer<typeof createCategorySchema>
type UpdateCategoryInput = z.infer<typeof updateCategorySchema> & { id: number }
type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>

export function useCreateCategoryGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      apiPost<IdResponse>('/api/categories/groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      apiPost<CategoryCreateResponse>('/api/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryInput) =>
      apiPatch<IdResponse>(`/api/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useArchiveCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/categories/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useUnarchiveCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<IdResponse>(`/api/categories/${id}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<IdResponse>(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useReorderCategories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReorderCategoriesInput) =>
      apiPost<void>('/api/categories/reorder', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}
