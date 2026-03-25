import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import { queryKeys } from './query-keys'
import type {
  PeriodsListResponse,
  PaySchedulesResponse,
  PaySchedule,
  PayHistoryEntry,
  IdResponse,
} from './types'
import {
  generatePeriodsSchema,
  createScheduleSchema,
  updateScheduleSchema,
  updateSubPeriodSchema,
  addIncomeLineSchema,
  updateIncomeLineSchema,
  addPayChangeSchema,
  updatePayChangeSchema,
} from '@/lib/validators/periods'

// ─── Queries ─────────────────────────────────────────────────

export function usePeriods() {
  return useQuery({
    queryKey: queryKeys.periods.list(),
    queryFn: () =>
      apiGet<PeriodsListResponse>('/api/periods'),
  })
}

export function useSchedules() {
  return useQuery({
    queryKey: queryKeys.periods.schedules(),
    queryFn: () =>
      apiGet<PaySchedulesResponse>('/api/periods/schedules'),
  })
}

export function useSchedule(id: number) {
  return useQuery({
    queryKey: queryKeys.periods.scheduleDetail(id),
    queryFn: () =>
      apiGet<PaySchedule>(`/api/periods/schedules/${id}`),
    enabled: !!id,
  })
}

export function usePayHistory(scheduleId: number) {
  return useQuery({
    queryKey: queryKeys.periods.payHistory(scheduleId),
    queryFn: () =>
      apiGet<PayHistoryEntry[]>(`/api/periods/pay-history/${scheduleId}`),
    enabled: !!scheduleId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

type GeneratePeriodsInput = z.infer<typeof generatePeriodsSchema>
type CreateScheduleInput = z.infer<typeof createScheduleSchema>
type UpdateScheduleInput = z.infer<typeof updateScheduleSchema> & { id: number }
type UpdateSubPeriodInput = z.infer<typeof updateSubPeriodSchema> & { id: number }
type AddIncomeLineInput = z.infer<typeof addIncomeLineSchema>
type UpdateIncomeLineInput = z.infer<typeof updateIncomeLineSchema> & { id: number }
type AddPayChangeInput = z.infer<typeof addPayChangeSchema>
type UpdatePayChangeInput = z.infer<typeof updatePayChangeSchema> & { id: number }

export function useGeneratePeriods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: GeneratePeriodsInput) =>
      apiPost<void>('/api/periods/generate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.periodsStatus() })
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}

export function useRegeneratePeriods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<void>('/api/periods/regenerate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.periodsStatus() })
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all })
    },
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateScheduleInput) =>
      apiPost<IdResponse>('/api/periods/schedules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.schedules() })
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateScheduleInput) =>
      apiPatch<IdResponse>(`/api/periods/schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.schedules() })
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/periods/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.schedules() })
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useSetPrimarySchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiPost<void>(`/api/periods/schedules/${id}/primary`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.schedules() })
    },
  })
}

export function useUpdateSubPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSubPeriodInput) =>
      apiPatch<IdResponse>(`/api/periods/sub-periods/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.periodsStatus() })
    },
  })
}

export function useDeletePeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/periods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.periodsStatus() })
    },
  })
}

export function useAddIncomeLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddIncomeLineInput) =>
      apiPost<IdResponse>('/api/periods/income-lines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useUpdateIncomeLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateIncomeLineInput) =>
      apiPatch<IdResponse>(`/api/periods/income-lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useDeleteIncomeLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/periods/income-lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all })
    },
  })
}

export function useAddPayChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddPayChangeInput) =>
      apiPost<IdResponse>('/api/periods/pay-changes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useUpdatePayChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePayChangeInput) =>
      apiPatch<IdResponse>(`/api/periods/pay-changes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}

export function useDeletePayChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      apiDelete<void>(`/api/periods/pay-changes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periods.all })
    },
  })
}
