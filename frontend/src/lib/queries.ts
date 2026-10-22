import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from './api'
import type {
  BrandKit,
  Campaign,
  Client,
  ClientStatus,
  ContentItem,
  FinanceSummary,
  Idea,
  KnowledgeDoc,
  Lead,
  LeadStage,
  LeadStageChange,
  LedgerEntry,
  Meeting,
  MonthlyResult,
  Paged,
  Payment,
  PlanningItem,
  PortfolioSummary,
  ReferenceLink,
  ScriptTemplate,
  StudioProject,
  Task,
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

// ---------------------------------------------------------------- fase 3

export function useTasks(filters: { open?: boolean; clientId?: string }) {
  return useQuery({ queryKey: ['tasks', filters], queryFn: () => api.get<Task[]>(`/api/tasks${qs(filters)}`) })
}

export function useIdeas() {
  return useQuery({ queryKey: ['ideas'], queryFn: () => api.get<Idea[]>('/api/ideas') })
}

export function useScripts() {
  return useQuery({ queryKey: ['scripts'], queryFn: () => api.get<ScriptTemplate[]>('/api/scripts'), staleTime: 60_000 })
}

export function useContents(filters: { status?: string; clientId?: string; channel?: string }) {
  return useQuery({ queryKey: ['contents', filters], queryFn: () => api.get<ContentItem[]>(`/api/contents${qs(filters)}`) })
}

export function useKnowledge() {
  return useQuery({ queryKey: ['knowledge'], queryFn: () => api.get<KnowledgeDoc[]>('/api/knowledge') })
}

export function useStudioProjects() {
  return useQuery({ queryKey: ['studio-projects'], queryFn: () => api.get<StudioProject[]>('/api/studio/projects') })
}

export function useBrandKits() {
  return useQuery({ queryKey: ['studio-kits'], queryFn: () => api.get<BrandKit[]>('/api/studio/kits') })
}

export function useReferences(tag: string) {
  return useQuery({ queryKey: ['studio-references', tag], queryFn: () => api.get<ReferenceLink[]>(`/api/studio/references${qs({ tag })}`) })
}

export function usePlanning(from: string, to: string) {
  return useQuery({ queryKey: ['planning', from, to], queryFn: () => api.get<PlanningItem[]>(`/api/planning${qs({ from, to })}`) })
}
