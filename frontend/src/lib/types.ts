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

/** Linha do histórico do lead: mudança de etapa (stage) ou anotação (note). */
export interface LeadTimelineItem {
  kind: 'stage' | 'note'
  at: string
  byId: string | null
  from: LeadStage | null
  to: LeadStage | null
  noteId: string | null
  text: string | null
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
  contactEmail: string | null
  contractedServices: string | null
  paymentMethod: string | null
  contractStart: string | null
  contractEnd: string | null
  readjustment: string | null
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
  contactEmail: string | null
  contractedServices: string | null
  paymentMethod: string | null
  contractStart: string | null
  contractEnd: string | null
  readjustment: string | null
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

// ---------------------------------------------------------------- fase 2: financeiro e atividades

export type PaymentKind = 'Mensalidade' | 'Implementacao' | 'Avulso'
export type PaymentStatus = 'Pendente' | 'Pago' | 'Cancelado'

export interface Payment {
  id: string
  clientId: string
  clientName: string
  kind: PaymentKind
  referenceMonth: string
  description: string | null
  amount: number
  dueDate: string
  paidOn: string | null
  status: PaymentStatus
  overdue: boolean
  version: number
}

export interface PaymentInput {
  kind: PaymentKind
  referenceMonth: string
  amount: number
  dueDate: string
  description: string | null
}

export type LedgerKind = 'Receita' | 'Despesa'
export type LedgerStatus = 'Previsto' | 'Realizado' | 'Cancelado'

export interface LedgerEntry {
  id: string
  kind: LedgerKind
  date: string
  description: string
  category: string | null
  amount: number
  clientId: string | null
  clientName: string | null
  status: LedgerStatus
  settledOn: string | null
  overdue: boolean
  version: number
}

export interface LedgerInput {
  kind: LedgerKind
  date: string
  description: string
  category: string | null
  amount: number
  clientId: string | null
}

export interface FinanceSummary {
  month: string
  received: number
  expected: number
  overdue: number
  overdueCount: number
  expenses: number
  expensesPlanned: number
  result: number
}

export interface Meeting {
  id: string
  clientId: string
  heldAt: string
  subject: string
  notes: string | null
  nextSteps: string | null
  createdById: string | null
  version: number
}

export type CampaignStatus = 'Planejada' | 'Ativa' | 'Pausada' | 'Encerrada'

export interface Campaign {
  id: string
  clientId: string
  name: string
  objective: string | null
  audience: string | null
  creatives: string | null
  startDate: string
  endDate: string | null
  budget: number
  status: CampaignStatus
  version: number
}

export interface MonthlyResult {
  id: string
  clientId: string
  month: string
  adSpend: number
  leads: number
  sales: number
  revenue: number
  costPerLead: number | null
  costPerSale: number | null
  roas: number | null
  notes: string | null
  version: number
}

export interface UserSummary {
  id: string
  email: string
  fullName: string
  isActive: boolean
  roles: string[]
}

// ---------------------------------------------------------------- fase 3: planejamento e conteúdo

export type Priority = 'Alta' | 'Media' | 'Baixa'
export type TodoStatus = 'Aberta' | 'EmAndamento' | 'Concluida' | 'Cancelada'

export interface Task {
  id: string
  title: string
  notes: string | null
  type: string | null
  dueDate: string | null
  priority: Priority
  status: TodoStatus
  clientId: string | null
  clientName: string | null
  leadId: string | null
  assigneeId: string | null
  completedAt: string | null
  overdue: boolean
  version: number
}

export type IdeaStatus = 'Nova' | 'EmAnalise' | 'Aprovada' | 'EmExecucao' | 'Descartada'

export interface Idea {
  id: string
  title: string
  category: string | null
  priority: Priority
  status: IdeaStatus
  notes: string | null
  nextStep: string | null
  date: string | null
  clientId: string | null
  clientName: string | null
  version: number
}

export type ScriptStage = 'AbordagemInicial' | 'Qualificacao' | 'FollowUp' | 'RespostaDoLead' | 'Objecoes' | 'Fechamento' | 'Parceria'

export interface ScriptTemplate {
  id: string
  title: string
  stage: ScriptStage
  channel: string | null
  niche: string | null
  usage: string | null
  body: string
  version: number
}

export type ContentFormat = 'Post' | 'Carrossel' | 'Reels' | 'Story' | 'Anuncio' | 'Video' | 'Outro'
export type ContentStatus = 'Ideia' | 'Roteiro' | 'Producao' | 'Aprovacao' | 'Agendado' | 'Publicado'

export interface ContentItem {
  id: string
  title: string
  format: ContentFormat
  status: ContentStatus
  channel: string | null
  objective: string | null
  publishDate: string | null
  clientId: string | null
  clientName: string | null
  body: string | null
  version: number
}

export interface KnowledgeDoc {
  id: string
  title: string
  body: string
  source: string | null
  sortOrder: number
  version: number
}

export type StudioStatus = 'Briefing' | 'EmCriacao' | 'Revisao' | 'Aprovado' | 'Entregue'
export type StudioKind = 'Imagem' | 'Carrossel' | 'Motion' | 'Video' | 'Anuncio' | 'Outro'

export interface StudioProject {
  id: string
  title: string
  clientId: string | null
  clientName: string | null
  kind: StudioKind
  status: StudioStatus
  brief: string | null
  visualDirection: string | null
  storyboard: string | null
  deliverables: string | null
  dueDate: string | null
  version: number
}

export interface BrandKit {
  id: string
  clientId: string | null
  clientName: string | null
  name: string
  colors: string[]
  fonts: string | null
  tone: string | null
  elements: string | null
  logoUrl: string | null
  version: number
}

export interface ReferenceLink {
  id: string
  title: string
  url: string
  tags: string | null
  note: string | null
  clientId: string | null
  clientName: string | null
  version: number
}

export interface PlanningItem {
  date: string
  kind: string
  title: string
  subtitle: string | null
  link: string
  overdue: boolean
  amount: number | null
}

// ---------------------------------------------------------------- ficha do cliente: perfil e acessos

export interface ClientProfile {
  clientId: string
  website: string | null
  instagram: string | null
  facebook: string | null
  tikTok: string | null
  whatTheySell: string | null
  idealCustomer: string | null
  differentiators: string | null
  competitors: string | null
  seasonality: string | null
  mainGoal: string | null
  needs: string | null
  toneOfVoice: string | null
  contentPillars: string | null
  whatWorked: string | null
  adBudget: number | null
  updatedAt: string | null
  /** 0 enquanto a ficha ainda não foi gravada. */
  version: number
}

export type ClientProfileInput = Omit<ClientProfile, 'clientId' | 'updatedAt' | 'version'>

export interface ClientAccess {
  id: string
  clientId: string
  platform: string
  account: string | null
  accessType: string | null
  passwordLocation: string | null
  grantedOn: string | null
  note: string | null
  version: number
}
