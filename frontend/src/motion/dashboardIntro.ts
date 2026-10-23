import { brl } from '../lib/format'
import { MOTION_OK, gsap } from './gsap'

const format = (kind: string | undefined, value: number) => (kind === 'brl' ? brl(value) : String(Math.round(value)))

/**
 * Entrada do painel, uma linha do tempo curta (cerca de 1s) que encadeia o que o painel mostra:
 * cartão da meta (opacidade) → máscara que revela a barra de segmentos → segmentos mudam de cor → números contam
 * → barras do funil crescem → demais cartões sobem. Roda uma vez por sessão (ver policy.ts).
 */
export function playDashboardIntro(root: HTMLElement): () => void {
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const q = <T extends Element>(sel: string) => gsap.utils.toArray<T>(sel, root)
      const goal = q('.goal')
      const segments = q('.segments, .bar')
      const filled = q('.segments i.on')
      const counters = q<HTMLElement>('[data-count]')
      const bars = q('.funnel .bar > i')
      const cards = q('.dash-cols .card')
      const track = getComputedStyle(root).getPropertyValue('--bar-track').trim() || '#eceef2'

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from(goal, { autoAlpha: 0, y: 10, duration: 0.45 })
      if (segments.length) tl.from(segments, { clipPath: 'inset(0 100% 0 0 round 4px)', duration: 0.6 }, '<0.08')
      if (filled.length) tl.from(filled, { backgroundColor: track, duration: 0.4, stagger: 0.06, ease: 'power1.out' }, '<0.12')
      counters.forEach((el) => {
        const target = Number(el.dataset.count)
        if (!Number.isFinite(target)) return
        const state = { v: 0 }
        el.textContent = format(el.dataset.format, 0)
        tl.to(
          state,
          {
            v: target,
            duration: 0.9,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = format(el.dataset.format, state.v)
            },
            onComplete: () => {
              el.textContent = format(el.dataset.format, target)
            },
          },
          0.1,
        )
      })
      if (bars.length) tl.from(bars, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.5, stagger: 0.04 }, '-=0.45')
      if (cards.length) tl.from(cards, { autoAlpha: 0, y: 10, duration: 0.4, stagger: 0.07 }, '<0.05')

      root.classList.remove('intro-pending') // os estados iniciais já foram aplicados pelo from(): nada pisca
      return () => {
        tl.kill()
        counters.forEach((el) => {
          el.textContent = format(el.dataset.format, Number(el.dataset.count))
        })
      }
    })
  }, root)
  return () => {
    ctx.revert()
    root.classList.remove('intro-pending')
  }
}
