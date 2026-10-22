/** Valor ausente em células de tabela, fichas e métricas. */
export const EMPTY = '—'

const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function brl(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : brlFormat.format(value)
}

/** Formata uma data ISO (AAAA-MM-DD ou datetime) como DD/MM/AAAA sem passar por fuso horário. */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Data e hora locais: 22/10/2026 14:30. */
export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dateBR(todayISO(d))} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Hora local: 14:30. */
export function timeBR(iso: string | null | undefined): string {
  if (!iso) return EMPTY
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Dia e mês, sem ano: 22/10. Para listas curtas em que o ano é óbvio. */
export function dateShort(iso: string | null | undefined): string {
  return iso ? dateBR(iso).slice(0, 5) : EMPTY
}

/** Mês de referência: 10/2026. */
export function monthYear(iso: string | null | undefined): string {
  return iso ? dateBR(iso).slice(3) : EMPTY
}

/** Dia relativo a hoje: hoje, amanhã, ontem, em 3 dias, há 2 dias; além de uma semana, a data completa. */
export function relativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return EMPTY
  const d = daysUntil(iso, now)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d === -1) return 'ontem'
  if (d > 1 && d <= 7) return `em ${d} dias`
  if (d < -1 && d >= -7) return `há ${-d} dias`
  return dateBR(iso)
}

/** Prazo: vence hoje, vence em 3 dias, venceu há 2 dias; além de uma semana, só a data. */
export function dueText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return EMPTY
  const d = daysUntil(iso, now)
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  if (d > 1 && d <= 7) return `vence em ${d} dias`
  if (d === -1) return 'venceu ontem'
  if (d < -1 && d >= -7) return `venceu há ${-d} dias`
  if (d < -7) return `venceu em ${dateBR(iso)}`
  return dateBR(iso)
}

export type DateMode = 'date' | 'short' | 'month' | 'datetime' | 'relative' | 'due'

/** Único ponto de formatação de datas na interface; escolha o modo, não fatie strings. */
export function formatDate(iso: string | null | undefined, mode: DateMode = 'date'): string {
  switch (mode) {
    case 'short':
      return dateShort(iso)
    case 'month':
      return monthYear(iso)
    case 'datetime':
      return dateTimeBR(iso)
    case 'relative':
      return relativeDay(iso)
    case 'due':
      return dueText(iso)
    default:
      return dateBR(iso)
  }
}

/** Data local de hoje como AAAA-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** Soma dias a uma data AAAA-MM-DD (calendário local). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + days))
}

/** Follow-up vencido: data anterior a hoje. */
export function isOverdue(date: string | null | undefined, today: string = todayISO()): boolean {
  return !!date && date.slice(0, 10) < today
}

/** Dias inteiros entre hoje e a data (negativo se já passou). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86_400_000)
}

/** Link do WhatsApp para um telefone brasileiro (assume DDI 55 quando vier só DDD + número). */
export function whatsappUrl(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Converte texto de formulário em número (aceita vírgula decimal); vazio vira null. */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(/\./g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** ISO com fuso -> valor de <input type="datetime-local"> no horário local. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Valor de <input type="datetime-local"> (horário local) -> ISO UTC; vazio vira null. */
export function fromDateTimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

/**
 * Preenche os placeholders de um script comercial: {{empresa}}, {{contato}} e {{meu_nome}}.
 * Sem valor, {{empresa}} vira "sua empresa" e os demais somem junto com o espaço que os antecede
 * ("Oi {{contato}}, tudo bem?" vira "Oi, tudo bem?"), para o texto não ficar quebrado.
 */
export function renderScript(body: string, vars: { empresa?: string | null; contato?: string | null; meu_nome?: string | null }): string {
  return body.replace(/(\s*)\{\{\s*(empresa|contato|meu_nome)\s*\}\}/gi, (_match, space: string, key: string) => {
    const k = key.toLowerCase() as keyof typeof vars
    const value = vars[k]?.trim()
    if (value) return space + value
    return k === 'empresa' ? `${space}sua empresa` : ''
  })
}

/** Link do WhatsApp com o texto já preenchido. */
export function whatsappUrlWithText(raw: string | null | undefined, text: string): string | null {
  const base = whatsappUrl(raw)
  return base ? `${base}?text=${encodeURIComponent(text)}` : null
}

/** Devolve a URL só se for http(s); qualquer outro esquema (javascript:, data:) vira null. Defesa em profundidade: a API já valida. */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
