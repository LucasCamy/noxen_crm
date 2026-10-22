const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function brl(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : brlFormat.format(value)
}

/** Formata uma data ISO (AAAA-MM-DD ou datetime) como DD/MM/AAAA sem passar por fuso horário. */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
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
