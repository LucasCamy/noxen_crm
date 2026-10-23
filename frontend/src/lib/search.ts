/** Texto sem acento e em minúsculas, para buscas que ignoram acentuação ("Reuniao" encontra "Reunião"). */
export const norm = (s: string | null | undefined): string => (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Verdadeiro quando todos os termos da busca aparecem em algum dos campos (busca vazia aceita tudo). */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = fields.map(norm).join(' ')
  return terms.every((t) => haystack.includes(t))
}
