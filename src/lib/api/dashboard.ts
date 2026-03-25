import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import { queryKeys } from './query-keys'
import type { DashboardResponse } from './types'

// ─── Queries ─────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => apiGet<DashboardResponse>('/api/dashboard'),
  })
}
