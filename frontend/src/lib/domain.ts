import type { ClientStatus, LeadSource, LeadStage } from './types'

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
