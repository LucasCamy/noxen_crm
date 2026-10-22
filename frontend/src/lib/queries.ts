import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from './api'
import type {
  Campaign,
  Client,
  ClientStatus,
  FinanceSummary,
  Lead,
  LeadStage,
  LeadStageChange,
  LedgerEntry,
  Meeting,
  MonthlyResult,
  Paged,
  Payment,
  PortfolioSummary,
  UserLookup,
  UserSummary,
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

// ---------------------------------------------------------------- fase 2

export function useFinanceSummary(month: string, enabled = true) {
  return useQuery({
    queryKey: ['finance-summary', month],
    queryFn: () => api.get<FinanceSummary>(`/api/finance/summary${qs({ month })}`),
    enabled,
  })
}

export function usePayments(filters: { month?: string; clientId?: string; status?: string }, enabled = true) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.get<Paged<Payment>>(`/api/payments${qs({ ...filters, pageSize: 100 })}`),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useLedger(month: string, enabled = true) {
  return useQuery({
    queryKey: ['ledger', month],
    queryFn: () => api.get<Paged<LedgerEntry>>(`/api/ledger${qs({ month, pageSize: 100 })}`),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useMeetings(clientId: string) {
  return useQuery({ queryKey: ['meetings', clientId], queryFn: () => api.get<Meeting[]>(`/api/clients/${clientId}/meetings`) })
}

export function useCampaigns(clientId: string) {
  return useQuery({ queryKey: ['campaigns', clientId], queryFn: () => api.get<Campaign[]>(`/api/clients/${clientId}/campaigns`) })
}

export function useResults(clientId: string) {
  return useQuery({ queryKey: ['results', clientId], queryFn: () => api.get<MonthlyResult[]>(`/api/clients/${clientId}/results`) })
}

export function useUserList(enabled: boolean) {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<UserSummary[]>('/api/users'), enabled })
}
