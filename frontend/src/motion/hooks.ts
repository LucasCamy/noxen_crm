import { useEffect, useLayoutEffect, type RefObject } from 'react'
import { prefersReducedMotion, shouldPlayDashboardIntro } from './policy'

/** Carrega o módulo de animação só quando vai usá-lo e devolve a função de limpeza. */
function runLazy(root: HTMLElement, load: () => Promise<(root: HTMLElement) => () => void>): () => void {
  let cancelled = false
  let stop: (() => void) | undefined
  const fallback = window.setTimeout(() => root.classList.remove('intro-pending'), 2000)
  load()
    .then((play) => {
      if (!cancelled) stop = play(root)
    })
    .catch(() => root.classList.remove('intro-pending'))
  return () => {
    cancelled = true
    window.clearTimeout(fallback)
    stop?.()
    root.classList.remove('intro-pending')
  }
}

/** Entrada do painel: uma vez por sessão, depois que os dados chegaram. O conteúdo fica oculto até a linha do tempo começar (sem piscar). */
export function useDashboardIntro(ref: RefObject<HTMLElement | null>, ready: boolean) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!ready || !root || !shouldPlayDashboardIntro()) return
    root.classList.add('intro-pending')
    return runLazy(root, () => import('./dashboardIntro').then((m) => m.playDashboardIntro))
  }, [ready, ref])
}

/** Entrada do login: a cada abertura, só com movimento permitido. */
export function useLoginIntro(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    root.classList.add('intro-pending')
    return runLazy(root, () => import('./loginIntro').then((m) => m.playLoginIntro))
  }, [ref])
}

/** Entrada por rolagem para blocos abaixo da primeira tela. `dep` muda quando a lista muda (filtros, dados novos). */
export function useScrollReveal(ref: RefObject<HTMLElement | null>, selector: string, dep: unknown) {
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    let cancelled = false
    let stop: (() => void) | undefined
    void import('./reveal').then((m) => {
      if (!cancelled) stop = m.revealOnScroll(root, selector)
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [ref, selector, dep])
}
