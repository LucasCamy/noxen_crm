import { describe, expect, it } from 'vitest'
import { firstName, renderScript, whatsappUrlWithText } from './format'

describe('renderScript', () => {
  it('preenche empresa, contato e meu_nome (com espaços e caixa variados)', () => {
    const out = renderScript('Oi {{contato}}, aqui é {{ meu_nome }} da Noxen. Vi a {{EMPRESA}}.', {
      empresa: 'Padaria Trigo',
      contato: 'Maria',
      meu_nome: 'Ana',
    })
    expect(out).toBe('Oi Maria, aqui é Ana da Noxen. Vi a Padaria Trigo.')
  })

  it('omite contato e nome ausentes junto com o espaço, e usa "sua empresa" no lugar da empresa', () => {
    const out = renderScript('Oi {{contato}}, tudo bem? Sobre {{empresa}} {{meu_nome}}', { empresa: ' ', contato: null })
    expect(out).toBe('Oi, tudo bem? Sobre sua empresa')
    expect(out).not.toContain('{{')
  })

  it('não mexe em outros textos entre chaves', () => {
    expect(renderScript('Use {{outra}} variável', { empresa: 'X' })).toBe('Use {{outra}} variável')
  })
})

describe('whatsappUrlWithText', () => {
  it('codifica o texto na query', () => {
    expect(whatsappUrlWithText('(67) 99999-0000', 'Oi, tudo bem? R$ 100')).toBe(
      'https://wa.me/5567999990000?text=Oi%2C%20tudo%20bem%3F%20R%24%20100',
    )
  })

  it('devolve null sem telefone válido', () => {
    expect(whatsappUrlWithText(null, 'Oi')).toBeNull()
  })
})

describe('firstName', () => {
  it('pega o primeiro nome', () => {
    expect(firstName('  Ana Souza ')).toBe('Ana')
    expect(firstName('')).toBe('')
  })
})
