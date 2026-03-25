import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiGet, apiPost } from './client'
import { queryKeys } from './query-keys'
import type { SettingValue } from './types'
import { settingsSetSchema } from '@/lib/validators/settings'

// ─── Queries ─────────────────────────────────────────────────

export function useSetting(key: string) {
  return useQuery({
    queryKey: queryKeys.settings.byKey(key),
    queryFn: () => apiGet<SettingValue>('/api/settings', { key }),
  })
}

// ─── Mutations ───────────────────────────────────────────────

type UpdateSettingInput = z.infer<typeof settingsSetSchema>

export function useUpdateSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateSettingInput) =>
      apiPost<SettingValue>('/api/settings', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.byKey(variables.key),
      })
    },
  })
}
