import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from './api'
import type {
  Client,
  ClientStatus,
  Lead,
  LeadStage,
  LeadStageChange,
  Paged,
  PortfolioSummary,
  UserLookup,
} from './types'

export const leadsKey = (stage: LeadStage | null, search: string, ownerId: string | null) =>
  ['leads', { stage, search, ownerId }] as const

export function fetchLeads(stage: LeadStage | null, search: string, ownerId: string | null, pageSize = 50) {
  return api.get<Paged<Lead>>(`/api/leads${qs({ stage, search, ownerId, pageSize })}`)
}

export function useLeadHistory(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-history', leadId],
    queryFn: () => api.get<LeadStageChange[]>(`/api/leads/${leadId}/history`),
    enabled: !!leadId,
  })
}

export function useClients(status: ClientStatus | '', search: string, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['clients', { status, search, page, pageSize }],
    queryFn: () => api.get<Paged<Client>>(`/api/clients${qs({ status, search, page, pageSize })}`),
    placeholderData: keepPreviousData,
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get<Client>(`/api/clients/${id}`),
    enabled: !!id,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<PortfolioSummary>('/api/dashboard/portfolio'),
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users-lookup'],
    queryFn: () => api.get<UserLookup[]>('/api/users/lookup'),
    staleTime: 5 * 60_000,
  })
}
