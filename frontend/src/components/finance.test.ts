import { describe, expect, it } from 'vitest'
import { paymentBadge } from './FinanceParts'

describe('paymentBadge', () => {
  it('mostra Atrasado só para pendente vencida', () => {
    expect(paymentBadge({ status: 'Pendente', overdue: true })).toEqual({ tone: 'danger', label: 'Atrasado' })
    expect(paymentBadge({ status: 'Pendente', overdue: false })).toEqual({ tone: 'warning', label: 'Pendente' })
  })

  it('pago e cancelado ignoram o atraso', () => {
    expect(paymentBadge({ status: 'Pago', overdue: false }).label).toBe('Pago')
    expect(paymentBadge({ status: 'Cancelado', overdue: true }).label).toBe('Cancelado')
  })
})
