/**
 * Regras de quando animar, sem depender do GSAP (por isso pode ser importado sem custo).
 * Critério das skills de movimento: a frequência manda. Telas que a pessoa abre dezenas de vezes por dia
 * não ganham entrada animada a cada visita; o painel anima uma vez por sessão e o login, que é raro, pode ser mais expressivo.
 */
export const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SESSION_KEY = 'noxen:intro:dashboard'

/** Verdadeiro na primeira vez que o painel abre na sessão (e só se a pessoa aceita movimento). */
export function shouldPlayDashboardIntro(): boolean {
  if (prefersReducedMotion()) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    return false
  }
}
