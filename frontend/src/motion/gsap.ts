/**
 * Único ponto de entrada do GSAP no projeto. Os módulos de `src/motion` importam daqui e são carregados
 * sob demanda (import dinâmico), então a biblioteca fica fora do pacote inicial e só chega depois da primeira pintura.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

/** Toda animação roda dentro disto: com prefers-reduced-motion, nada é registrado e o estado final aparece direto. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)'

export { gsap, ScrollTrigger, SplitText }
