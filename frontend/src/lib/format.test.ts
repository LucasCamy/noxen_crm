import { describe, expect, it } from 'vitest'
import { dateBR, daysUntil, initials, isOverdue, parseMoney, todayISO, whatsappUrl } from './format'

describe('format', () => {
  it('formata datas sem deslocar por fuso', () => {
    expect(dateBR('2026-11-30')).toBe('30/11/2026')
    expect(dateBR('2026-11-30T23:59:00-04:00')).toBe('30/11/2026')
    expect(dateBR(null)).toBe('—')
  })

  it('detecta follow-up vencido apenas para datas anteriores a hoje', () => {
    expect(isOverdue('2026-10-21', '2026-10-22')).toBe(true)
    expect(isOverdue('2026-10-22', '2026-10-22')).toBe(false)
    expect(isOverdue('2026-10-23', '2026-10-22')).toBe(false)
    expect(isOverdue(null, '2026-10-22')).toBe(false)
  })

  it('usa a data local em todayISO', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('conta dias até uma data', () => {
    const now = new Date(2026, 9, 22, 15, 0)
    expect(daysUntil('2026-11-30', now)).toBe(39)
    expect(daysUntil('2026-10-20', now)).toBe(-2)
  })

  it('monta o link do WhatsApp assumindo DDI 55', () => {
    expect(whatsappUrl('(67) 99999-0000')).toBe('https://wa.me/5567999990000')
    expect(whatsappUrl('+55 67 99999-0000')).toBe('https://wa.me/5567999990000')
    expect(whatsappUrl('12345')).toBeNull()
    expect(whatsappUrl(null)).toBeNull()
  })

  it('interpreta valores em reais digitados em pt-BR', () => {
    expect(parseMoney('5000')).toBe(5000)
    expect(parseMoney('5.000,50')).toBe(5000.5)
    expect(parseMoney('1500,5')).toBe(1500.5)
    expect(parseMoney('  ')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
  })

  it('gera iniciais', () => {
    expect(initials('Ana Souza')).toBe('AS')
    expect(initials('  maria da silva costa ')).toBe('MC')
    expect(initials('Noxen')).toBe('N')
    expect(initials('')).toBe('?')
  })
})
