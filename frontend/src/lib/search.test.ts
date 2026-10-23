import { describe, expect, it } from 'vitest'
import { matches, norm } from './search'

describe('search', () => {
  it('ignora acento e caixa', () => {
    expect(norm('Reunião Marcada')).toBe('reuniao marcada')
    expect(matches('reuniao', 'Reunião de diagnóstico')).toBe(true)
  })
  it('exige todos os termos, em qualquer campo', () => {
    expect(matches('clinica odonto', 'Clínica', 'Odonto Premium')).toBe(true)
    expect(matches('clinica pet', 'Clínica', 'Odonto Premium')).toBe(false)
  })
  it('busca vazia aceita tudo e tolera campos nulos', () => {
    expect(matches('  ', null, undefined)).toBe(true)
    expect(matches('x', null)).toBe(false)
  })
})
