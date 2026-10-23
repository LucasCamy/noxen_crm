import { MOTION_OK, ScrollTrigger, gsap } from './gsap'

/**
 * Entrada por rolagem para blocos que ficam abaixo da primeira tela (grades de cartões).
 * Regras das skills de movimento: só desloca 12px, dura 0,35s fixos (não acompanha a velocidade do scroll),
 * dispara uma vez e NÃO toca no que já está visível, para a tela nunca esperar por animação ao abrir.
 */
export function revealOnScroll(scope: HTMLElement, selector: string): () => void {
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const items = gsap.utils.toArray<HTMLElement>(selector, scope)
      const below = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92)
      if (below.length === 0) return
      gsap.set(below, { autoAlpha: 0, y: 12 })
      ScrollTrigger.batch(below, {
        start: 'top 92%',
        once: true,
        interval: 0.08,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power1.out', stagger: 0.04, overwrite: true, clearProps: 'opacity,visibility,transform' }),
      })
    })
  }, scope)
  return () => ctx.revert()
}
