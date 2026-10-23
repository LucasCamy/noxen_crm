import type {
  ClientStatus,
  ContentFormat,
  ContentStatus,
  IdeaStatus,
  LeadSource,
  LeadStage,
  Priority,
  ScriptStage,
  StudioKind,
  StudioStatus,
  TodoStatus,
} from './types'

export type Tone = 'neutral' | 'info' | 'teal' | 'warning' | 'brand' | 'success' | 'danger'

export const STAGES: { key: LeadStage; label: string; tone: Tone }[] = [
  { key: 'AContatar', label: 'A contatar', tone: 'neutral' },
  { key: 'Contatado', label: 'Contatado', tone: 'info' },
  { key: 'Respondeu', label: 'Respondeu', tone: 'teal' },
  { key: 'ReuniaoMarcada', label: 'Reunião marcada', tone: 'warning' },
  { key: 'PropostaEnviada', label: 'Proposta enviada', tone: 'brand' },
  { key: 'Fechado', label: 'Fechado', tone: 'success' },
  { key: 'Perdido', label: 'Perdido', tone: 'danger' },
]

export const SOURCES: { key: LeadSource; label: string }[] = [
  { key: 'Indicacao', label: 'Indicação' },
  { key: 'Instagram', label: 'Instagram' },
  { key: 'TikTok', label: 'TikTok' },
  { key: 'Facebook', label: 'Facebook' },
  { key: 'MetaAds', label: 'Meta Ads' },
  { key: 'WhatsApp', label: 'WhatsApp' },
  { key: 'ProspeccaoAtiva', label: 'Prospecção ativa' },
  { key: 'Evento', label: 'Evento' },
]

export const CLIENT_STATUSES: { key: ClientStatus; label: string; tone: Tone }[] = [
  { key: 'Implementacao', label: 'Implementação', tone: 'info' },
  { key: 'Ativo', label: 'Ativo', tone: 'success' },
  { key: 'Pausado', label: 'Pausado', tone: 'warning' },
  { key: 'Encerrado', label: 'Encerrado', tone: 'neutral' },
]

export const stageInfo = (key: LeadStage) => STAGES.find((s) => s.key === key)!
export const clientStatusInfo = (key: ClientStatus) => CLIENT_STATUSES.find((s) => s.key === key)!
export const sourceLabel = (key: LeadSource) => SOURCES.find((s) => s.key === key)?.label ?? key

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ',
  'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

/**
 * Espelho das regras de funil do backend (Lead.MoveTo), só para dar retorno imediato.
 * A API continua sendo a autoridade: ela responde 422 se algo escapar daqui.
 */
export function moveError(from: LeadStage, to: LeadStage): string | null {
  if (from === to) return null
  if (from === 'Fechado') return 'Um lead fechado não pode mudar de etapa.'
  if (from === 'Perdido' && to !== 'AContatar') return 'Um lead perdido só pode ser reaberto como "A contatar".'
  return null
}

// ---------------------------------------------------------------- fase 3

export const PRIORITIES: { key: Priority; label: string; tone: Tone }[] = [
  { key: 'Alta', label: 'Alta', tone: 'danger' },
  { key: 'Media', label: 'Média', tone: 'warning' },
  { key: 'Baixa', label: 'Baixa', tone: 'neutral' },
]
export const priorityInfo = (k: Priority) => PRIORITIES.find((p) => p.key === k)!

export const TODO_STATUSES: { key: TodoStatus; label: string }[] = [
  { key: 'Aberta', label: 'Aberta' },
  { key: 'EmAndamento', label: 'Em andamento' },
  { key: 'Concluida', label: 'Concluída' },
  { key: 'Cancelada', label: 'Cancelada' },
]

export const IDEA_STATUSES: { key: IdeaStatus; label: string; tone: Tone }[] = [
  { key: 'Nova', label: 'Nova', tone: 'info' },
  { key: 'EmAnalise', label: 'Em análise', tone: 'warning' },
  { key: 'Aprovada', label: 'Aprovada', tone: 'brand' },
  { key: 'EmExecucao', label: 'Em execução', tone: 'teal' },
  { key: 'Descartada', label: 'Descartada', tone: 'neutral' },
]
export const ideaStatusInfo = (k: IdeaStatus) => IDEA_STATUSES.find((s) => s.key === k)!

export const SCRIPT_STAGES: { key: ScriptStage; label: string }[] = [
  { key: 'AbordagemInicial', label: 'Abordagem inicial' },
  { key: 'Qualificacao', label: 'Qualificação' },
  { key: 'FollowUp', label: 'Follow-up' },
  { key: 'RespostaDoLead', label: 'Resposta do lead' },
  { key: 'Objecoes', label: 'Objeções' },
  { key: 'Fechamento', label: 'Fechamento' },
  { key: 'Parceria', label: 'Parceria' },
]
export const scriptStageLabel = (k: ScriptStage) => SCRIPT_STAGES.find((s) => s.key === k)?.label ?? k

export const CONTENT_FORMATS: { key: ContentFormat; label: string }[] = [
  { key: 'Post', label: 'Post' },
  { key: 'Carrossel', label: 'Carrossel' },
  { key: 'Reels', label: 'Reels/TikTok' },
  { key: 'Story', label: 'Story' },
  { key: 'Anuncio', label: 'Anúncio' },
  { key: 'Video', label: 'Vídeo' },
  { key: 'Outro', label: 'Outro' },
]
export const contentFormatLabel = (k: ContentFormat) => CONTENT_FORMATS.find((f) => f.key === k)?.label ?? k

export const CONTENT_STATUSES: { key: ContentStatus; label: string; tone: Tone }[] = [
  { key: 'Ideia', label: 'Ideia', tone: 'neutral' },
  { key: 'Roteiro', label: 'Roteiro', tone: 'info' },
  { key: 'Producao', label: 'Produção', tone: 'warning' },
  { key: 'Aprovacao', label: 'Aprovação', tone: 'brand' },
  { key: 'Agendado', label: 'Agendado', tone: 'teal' },
  { key: 'Publicado', label: 'Publicado', tone: 'success' },
]
export const contentStatusInfo = (k: ContentStatus) => CONTENT_STATUSES.find((s) => s.key === k)!

export const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Meta Ads', 'Google', 'Site']

export const STUDIO_STATUSES: { key: StudioStatus; label: string; tone: Tone }[] = [
  { key: 'Briefing', label: 'Briefing', tone: 'neutral' },
  { key: 'EmCriacao', label: 'Em criação', tone: 'info' },
  { key: 'Revisao', label: 'Revisão', tone: 'warning' },
  { key: 'Aprovado', label: 'Aprovado', tone: 'brand' },
  { key: 'Entregue', label: 'Entregue', tone: 'success' },
]

export const STUDIO_KINDS: { key: StudioKind; label: string }[] = [
  { key: 'Imagem', label: 'Imagem' },
  { key: 'Carrossel', label: 'Carrossel' },
  { key: 'Motion', label: 'Motion' },
  { key: 'Video', label: 'Vídeo' },
  { key: 'Anuncio', label: 'Anúncio' },
  { key: 'Outro', label: 'Outro' },
]
export const studioKindLabel = (k: StudioKind) => STUDIO_KINDS.find((x) => x.key === k)?.label ?? k

export const PAYMENT_METHODS = ['Pix', 'Boleto', 'Cartão', 'Transferência', 'Dinheiro']
