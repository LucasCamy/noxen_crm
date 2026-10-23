import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { MOTION_OK, ScrollTrigger, gsap } from './gsap'

let lenis: Lenis | null = null

/** Rola a página para o topo ao trocar de rota, com ou sem rolagem suave. */
function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}

/**
 * Camada de movimento da casca: rolagem suave (Lenis) sincronizada com o ScrollTrigger e uma barra fina de
 * progresso de leitura. Só liga com mouse/trackpad e sem prefers-reduced-motion; no toque, o scroll nativo é melhor.
 */
export default function MotionLayer() {
  const { pathname } = useLocation()
  const rail = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add(`${MOTION_OK} and (hover: hover) and (pointer: fine)`, () => {
      const instance = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        wheelMultiplier: 0.9,
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      })
      lenis = instance
      instance.on('scroll', ScrollTrigger.update)
      const tick = (time: number) => instance.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      return () => {
        gsap.ticker.remove(tick)
        instance.destroy()
        lenis = null
      }
    })
    return () => mm.revert()
  }, [])

  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const track = rail.current
      const fill = bar.current
      if (!track || !fill) return
      gsap.set(fill, { scaleX: 0, transformOrigin: '0% 50%' })
      const tween = gsap.to(fill, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          start: 0,
          end: 'max',
          scrub: 0.2,
          onRefresh: () => track.classList.toggle('is-scrollable', ScrollTrigger.maxScroll(window) > 8),
        },
      })

      // a altura da página muda quando os dados chegam: recalcula depois que o layout assenta
      let frame = 0
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => ScrollTrigger.refresh())
      })
      observer.observe(document.body)
      return () => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        tween.scrollTrigger?.kill()
        tween.kill()
        track.classList.remove('is-scrollable')
      }
    })
    return () => mm.revert()
  }, [])

  useEffect(() => {
    scrollToTop()
  }, [pathname])

  return (
    <div ref={rail} className="scroll-progress" aria-hidden>
      <span ref={bar} />
    </div>
  )
}
