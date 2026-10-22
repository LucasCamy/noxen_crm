import { describe, expect, it } from 'vitest'
import { STAGES, moveError } from './domain'

describe('moveError (espelho das regras do funil)', () => {
  it('permite avançar e recuar entre etapas abertas', () => {
    expect(moveError('AContatar', 'Contatado')).toBeNull()
    expect(moveError('PropostaEnviada', 'Respondeu')).toBeNull()
  })

  it('bloqueia qualquer mudança de um lead fechado', () => {
    for (const s of STAGES) if (s.key !== 'Fechado') expect(moveError('Fechado', s.key)).not.toBeNull()
  })

  it('só deixa reabrir lead perdido como "A contatar"', () => {
    expect(moveError('Perdido', 'AContatar')).toBeNull()
    expect(moveError('Perdido', 'Respondeu')).not.toBeNull()
    expect(moveError('Perdido', 'Fechado')).not.toBeNull()
  })

  it('não acusa erro ao soltar na mesma etapa', () => {
    expect(moveError('Contatado', 'Contatado')).toBeNull()
  })
})
