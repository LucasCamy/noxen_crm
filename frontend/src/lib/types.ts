export type LeadStage =
  | 'AContatar'
  | 'Contatado'
  | 'Respondeu'
  | 'ReuniaoMarcada'
  | 'PropostaEnviada'
  | 'Fechado'
  | 'Perdido'

export type LeadSource =
  | 'Indicacao'
  | 'Instagram'
  | 'TikTok'
  | 'Facebook'
  | 'MetaAds'
  | 'WhatsApp'
  | 'ProspeccaoAtiva'
  | 'Evento'

export type ClientStatus = 'Implementacao' | 'Ativo' | 'Pausado' | 'Encerrado'

export type Role = 'Admin' | 'Comercial' | 'Marketing'

export interface UserInfo {
  id: string
  email: string
  fullName: string
  roles: string[]
}

export interface AuthResponse {
  accessToken: string
  expiresAt: string
  refreshToken: string
  user: UserInfo
}

export interface UserLookup {
  id: string
  fullName: string
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Lead {
  id: string
  company: string
  contactName: string | null
  whatsapp: string | null
  instagram: string | null
  segment: string | null
  city: string | null
  state: string | null
  source: LeadSource
  stage: LeadStage
  nextStep: string | null
  nextStepDate: string | null
  estimatedValue: number | null
  lostReason: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
  version: number
}

/** Corpo de criação/edição de lead (em edição, inclua `version`). */
export interface LeadInput {
  company: string
  contactName: string | null
  whatsapp: string | null
  instagram: string | null
  segment: string | null
  city: string | null
  state: string | null
  source: LeadSource
  nextStep: string | null
  nextStepDate: string | null
  estimatedValue: number | null
  ownerId: string | null
}

export interface LeadStageChange {
  from: LeadStage
  to: LeadStage
  changedById: string | null
  changedAt: string
}

export interface Client {
  id: string
  leadId: string | null
  name: string
  legalName: string | null
  cnpj: string | null
  segment: string | null
  city: string | null
  state: string | null
  contactName: string | null
  contactWhatsapp: string | null
  status: ClientStatus
  implementationFee: number
  monthlyFee: number
  dueDay: number
  clientSince: string
  nextMeeting: string | null
  responsibleId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface ClientInput {
  name: string
  legalName: string | null
  cnpj: string | null
  segment: string | null
  city: string | null
  state: string | null
  contactName: string | null
  contactWhatsapp: string | null
  implementationFee: number
  monthlyFee: number
  dueDay: number
  nextMeeting: string | null
  responsibleId: string | null
  notes: string | null
}

export interface PortfolioSummary {
  activeClients: number
  targetClients: number
  deadline: string
  mrr: number
  clientsByStatus: Record<ClientStatus, number>
  leadsByStage: Record<LeadStage, number>
  openLeads: number
  openPipelineValue: number
  followUpsDue: number
  generatedAt: string
}
