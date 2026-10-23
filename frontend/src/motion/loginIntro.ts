import { MOTION_OK, SplitText, gsap } from './gsap'

/**
 * Entrada da tela de login (rara, então pode ser mais expressiva): o título sobe por dentro de uma máscara
 * de linha, os pontos entram em sequência e o formulário aparece. Desfaz a divisão do texto ao sair.
 */
export function playLoginIntro(root: HTMLElement): () => void {
  let split: SplitText | undefined
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const title = root.querySelector<HTMLElement>('.login-pitch h2')
      const points = gsap.utils.toArray<HTMLElement>('.login-points li', root)
      const form = root.querySelector<HTMLElement>('.login-form')
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      if (title) {
        split = SplitText.create(title, { type: 'lines', mask: 'lines', autoSplit: true })
        tl.from(split.lines, { yPercent: 110, duration: 0.8, stagger: 0.1 })
      }
      tl.from(points, { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.08 }, '-=0.45')
      if (form) tl.from(form, { autoAlpha: 0, y: 12, duration: 0.5 }, 0.15)
      root.classList.remove('intro-pending')
      return () => {
        tl.kill()
      }
    })
  }, root)
  return () => {
    split?.revert()
    ctx.revert()
    root.classList.remove('intro-pending')
  }
}
