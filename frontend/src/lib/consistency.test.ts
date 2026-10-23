import { describe, expect, it } from 'vitest'

/**
 * Trava de consistência visual: lê o código-fonte e falha quando alguém volta a escrever à mão
 * o que o sistema de design já resolve (ver docs/adr/0008). Cada regra aponta o componente certo.
 */
const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const styles = import.meta.glob('../styles/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const app = Object.entries(sources).filter(([path]) => !path.includes('.test.') && !path.includes('/lib/consistency'))
const screens = app.filter(([path]) => path.includes('/pages/') || path.includes('/components/'))

function offenders(files: [string, string][], pattern: RegExp, except: (path: string) => boolean = () => false): string[] {
  const hits: string[] = []
  for (const [path, text] of files) {
    if (except(path)) continue
    text.split('\n').forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${path.replace('../', 'src/')}:${i + 1}  ${line.trim().slice(0, 100)}`)
    })
  }
  return hits
}

describe('consistência do front', () => {
  it('formata datas só por lib/format (nada de fatiar texto nem toLocale*)', () => {
    expect(offenders(screens, /date[A-Za-z]*\([^)]*\)\.slice\(/)).toEqual([])
    expect(offenders(app, /toLocale(Date|Time)String/, (p) => p.endsWith('/lib/format.ts'))).toEqual([])
  })

  it('botão de criar é o CreateButton (sem Plus à mão)', () => {
    expect(offenders(app, /<Plus\b/, (p) => p.endsWith('/ui/Button.tsx'))).toEqual([])
  })

  it('ícones usam a escala ICON, nunca números soltos', () => {
    expect(offenders(app, /\bsize=\{\d+\}/)).toEqual([])
  })

  it('filtros e cartões usam os componentes do kit, não as classes antigas', () => {
    const old = /className="[^"]*(?<![\w-])(select-inline|field-inline|toolbar|check|panel|panel-head|module|module-head|module-body)(?![\w-])/
    expect(offenders(screens, old)).toEqual([])
  })

  it('style inline só para valor dinâmico (variável CSS, flex, cor de dado)', () => {
    const inline = offenders(screens, /style=\{\{/).filter((l) => !/--|flex:|background:/.test(l))
    expect(inline).toEqual([])
  })

  it('quadros cabem na largura: sem rolagem lateral no meio da tela', () => {
    const pages = Object.entries(styles).filter(([path]) => path.endsWith('/pages.css')) as [string, string][]
    expect(offenders(pages, /scroll-snap|grid-auto-flow:\s*column/)).toEqual([])
  })

  it('CSS fora dos tokens não tem cor, espaçamento, raio nem fonte soltos', () => {
    const files = Object.entries(styles).filter(([path]) => !path.endsWith('/tokens.css')) as [string, string][]
    expect(offenders(files, /#[0-9a-fA-F]{3,8}\b/, () => false).filter((l) => !/#000\b/.test(l))).toEqual([])
    expect(offenders(files, /^\s*(gap|row-gap|column-gap|padding[a-z-]*|margin[a-z-]*)\s*:[^;]*(?<![\w-])[2-9]\d*px/)).toEqual([])
    expect(offenders(files, /border-radius:\s*\d+px/)).toEqual([])
    expect(offenders(files, /font-size:\s*\d+px/)).toEqual([])
  })
})
