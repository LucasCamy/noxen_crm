import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { brl, formatDate, parseMoney, todayISO } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useClients } from '../lib/queries'
import type { LedgerEntry, LedgerInput, LedgerKind, Payment, PaymentInput, PaymentKind } from '../lib/types'
import { Badge, Button, DateValue, Dialog, ErrorNote, SelectField, TextField } from './ui'
import { ConfirmDialog, FormFooter, blankToNull, useForm } from './common'
import type { Tone } from '../lib/domain'

const KIND_LABEL: Record<PaymentKind, string> = { Mensalidade: 'Mensalidade', Implementacao: 'Implementação', Avulso: 'Avulso' }

export function paymentBadge(p: Pick<Payment, 'status' | 'overdue'>): { tone: Tone; label: string } {
  if (p.status === 'Pago') return { tone: 'success', label: 'Pago' }
  if (p.status === 'Cancelado') return { tone: 'neutral', label: 'Cancelado' }
  return p.overdue ? { tone: 'danger', label: 'Atrasado' } : { tone: 'warning', label: 'Pendente' }
}

const INVALIDATE_FINANCE = ['payments', 'ledger', 'finance-summary']

// ---------------------------------------------------------------- cobranças

export function PaymentsTable({ payments, showClient, canManage }: { payments: Payment[]; showClient: boolean; canManage: boolean }) {
  const [paying, setPaying] = useState<Payment | null>(null)
  const [cancelling, setCancelling] = useState<Payment | null>(null)
  const cancel = useCrmMutation(
    (p: Payment) => api.post<Payment>(`/api/payments/${p.id}/cancel`, { version: p.version }),
    INVALIDATE_FINANCE,
    'Cobrança cancelada.',
    () => setCancelling(null),
  )

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {showClient && <th scope="col">Cliente</th>}
              <th scope="col">Cobrança</th>
              <th scope="col">Vencimento</th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col">Status</th>
              {canManage && (
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const b = paymentBadge(p)
              return (
                <tr key={p.id}>
                  {showClient && <th scope="row">{p.clientName}</th>}
                  <td>
                    {KIND_LABEL[p.kind]} · {formatDate(p.referenceMonth, 'month')}
                    {p.description && <span className="muted small block">{p.description}</span>}
                  </td>
                  <td className="num"><DateValue value={p.dueDate} /></td>
                  <td className="num">{brl(p.amount)}</td>
                  <td>
                    <Badge tone={b.tone}>{b.label}</Badge>
                    {p.paidOn && <span className="muted small block">em <DateValue value={p.paidOn} /></span>}
                  </td>
                  {canManage && (
                    <td className="row-actions">
                      {p.status === 'Pendente' && (
                        <>
                          <Button type="button" size="sm" onClick={() => setPaying(p)}>
                            Registrar pagamento
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setCancelling(p)}>
                            Cancelar
                          </Button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PayDialog target={paying ? { id: paying.id, version: paying.version, label: `${paying.clientName} · ${brl(paying.amount)}`, url: `/api/payments/${paying.id}/pay` } : null} onClose={() => setPaying(null)} />
      <ConfirmDialog
        open={!!cancelling}
        title="Cancelar cobrança?"
        description={cancelling ? `${cancelling.clientName} · ${brl(cancelling.amount)} · vence em ${formatDate(cancelling.dueDate)}` : undefined}
        confirmLabel="Cancelar cobrança"
        danger
        busy={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        onClose={() => setCancelling(null)}
      />
    </>
  )
}

/** Baixa de cobrança ou de lançamento: pede a data (padrão hoje, nunca futura). */
export function PayDialog({ target, onClose }: { target: { id: string; version: number; label: string; url: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onClose={onClose} title="Registrar pagamento" description={target?.label}>
      {target && <PayForm key={target.id} target={target} onClose={onClose} />}
    </Dialog>
  )
}

function PayForm({ target, onClose }: { target: { id: string; version: number; url: string }; onClose: () => void }) {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const pay = useCrmMutation(
    () => api.post(target.url, target.url.includes('/ledger/') ? { settledOn: date, version: target.version } : { paidOn: date, version: target.version }),
    INVALIDATE_FINANCE,
    'Pagamento registrado.',
    onClose,
  )
  return (
    <form
      className="dialog-form"
      onSubmit={(e) => {
        e.preventDefault()
        pay.mutate(undefined)
      }}
    >
      <TextField label="Data do pagamento" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      {pay.error && <ErrorNote message={pay.error.message} />}
      <FormFooter pending={pay.isPending} submitLabel="Confirmar" onCancel={onClose} disabled={!date} />
    </form>
  )
}

export function PaymentFormDialog({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId?: string }) {
  return (
    <Dialog open={open} onClose={onClose} title="Nova cobrança" description="Mensalidade, implementação ou cobrança avulsa.">
      {open && <PaymentForm clientId={clientId} onClose={onClose} />}
    </Dialog>
  )
}

function PaymentForm({ clientId, onClose }: { clientId?: string; onClose: () => void }) {
  const clients = useClients('', '', 1, 100)
  const thisMonth = todayISO().slice(0, 7)
  const { values, bind } = useForm({ clientId: clientId ?? '', kind: 'Mensalidade', month: thisMonth, amount: '', dueDate: '', description: '' })
  const [error, setError] = useState<string | undefined>()
  const create = useCrmMutation(
    (body: PaymentInput) => api.post(`/api/clients/${values.clientId}/payments`, body),
    INVALIDATE_FINANCE,
    'Cobrança criada.',
    onClose,
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(values.amount)
    if (!values.clientId) return setError('Escolha o cliente.')
    if (amount === null || amount <= 0) return setError('Informe um valor maior que zero.')
    setError(undefined)
    create.mutate({
      kind: values.kind as PaymentKind,
      referenceMonth: `${values.month}-01`,
      amount,
      dueDate: values.dueDate,
      description: blankToNull(values.description),
    })
  }

  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        {!clientId && (
          <div className="span-2">
            <SelectField label="Cliente" required {...bind('clientId')}>
              <option value="">Escolher…</option>
              {clients.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <SelectField label="Tipo" {...bind('kind')}>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
        <TextField label="Mês de referência" type="month" required {...bind('month')} />
        <TextField label="Valor (R$)" inputMode="decimal" required {...bind('amount')} />
        <TextField label="Vencimento" type="date" required {...bind('dueDate')} />
        <div className="span-2">
          <TextField label="Descrição" maxLength={300} {...bind('description')} />
        </div>
      </div>
      {(error || create.error) && <ErrorNote message={error ?? create.error!.message} />}
      <FormFooter pending={create.isPending} submitLabel="Criar cobrança" onCancel={onClose} />
    </form>
  )
}

// ---------------------------------------------------------------- lançamentos

export function LedgerTable({ entries, canManage }: { entries: LedgerEntry[]; canManage: boolean }) {
  const [settling, setSettling] = useState<LedgerEntry | null>(null)
  const [cancelling, setCancelling] = useState<LedgerEntry | null>(null)
  const cancel = useCrmMutation(
    (e: LedgerEntry) => api.post<LedgerEntry>(`/api/ledger/${e.id}/cancel`, { version: e.version }),
    INVALIDATE_FINANCE,
    'Lançamento cancelado.',
    () => setCancelling(null),
  )

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Descrição</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col">Status</th>
              {canManage && (
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const realizado = e.status === 'Realizado'
              const tone: Tone = e.status === 'Cancelado' ? 'neutral' : realizado ? 'success' : e.overdue ? 'danger' : 'warning'
              const label = e.status === 'Cancelado' ? 'Cancelado' : realizado ? (e.kind === 'Receita' ? 'Recebido' : 'Pago') : e.overdue ? 'Atrasado' : 'Previsto'
              return (
                <tr key={e.id}>
                  <td className="num"><DateValue value={e.date} /></td>
                  <th scope="row">
                    {e.description}
                    <span className="muted small block">{[e.category, e.clientName].filter(Boolean).join(' · ')}</span>
                  </th>
                  <td>{e.kind}</td>
                  <td className={`num ${e.kind === 'Despesa' ? 'neg' : ''}`}>
                    {e.kind === 'Despesa' ? '− ' : ''}
                    {brl(e.amount)}
                  </td>
                  <td>
                    <Badge tone={tone}>{label}</Badge>
                    {e.settledOn && <span className="muted small block">em <DateValue value={e.settledOn} /></span>}
                  </td>
                  {canManage && (
                    <td className="row-actions">
                      {e.status === 'Previsto' && (
                        <>
                          <Button type="button" size="sm" onClick={() => setSettling(e)}>
                            {e.kind === 'Receita' ? 'Registrar recebimento' : 'Registrar pagamento'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setCancelling(e)}>
                            Cancelar
                          </Button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PayDialog target={settling ? { id: settling.id, version: settling.version, label: `${settling.description} · ${brl(settling.amount)}`, url: `/api/ledger/${settling.id}/settle` } : null} onClose={() => setSettling(null)} />
      <ConfirmDialog
        open={!!cancelling}
        title="Cancelar lançamento?"
        description={cancelling ? `${cancelling.description} · ${brl(cancelling.amount)}` : undefined}
        confirmLabel="Cancelar lançamento"
        danger
        busy={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        onClose={() => setCancelling(null)}
      />
    </>
  )
}

export function LedgerFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Novo lançamento" description="Receita avulsa ou despesa da agência.">
      {open && <LedgerForm onClose={onClose} />}
    </Dialog>
  )
}

function LedgerForm({ onClose }: { onClose: () => void }) {
  const clients = useClients('', '', 1, 100)
  const { values, bind } = useForm({ kind: 'Despesa', date: todayISO(), description: '', category: '', amount: '', clientId: '' })
  const [error, setError] = useState<string | undefined>()
  const create = useCrmMutation((body: LedgerInput) => api.post('/api/ledger', body), INVALIDATE_FINANCE, 'Lançamento criado.', onClose)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(values.amount)
    if (amount === null || amount <= 0) return setError('Informe um valor maior que zero.')
    setError(undefined)
    create.mutate({
      kind: values.kind as LedgerKind,
      date: values.date,
      description: values.description.trim(),
      category: blankToNull(values.category),
      amount,
      clientId: blankToNull(values.clientId),
    })
  }

  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <SelectField label="Tipo" {...bind('kind')}>
          <option value="Despesa">Despesa</option>
          <option value="Receita">Receita avulsa</option>
        </SelectField>
        <TextField label="Data prevista" type="date" required {...bind('date')} />
        <div className="span-2">
          <TextField label="Descrição" required maxLength={300} autoFocus {...bind('description')} />
        </div>
        <TextField label="Categoria" maxLength={100} {...bind('category')} placeholder="Ex.: Software, Projeto" />
        <TextField label="Valor (R$)" inputMode="decimal" required {...bind('amount')} />
        <div className="span-2">
          <SelectField label="Cliente (opcional)" {...bind('clientId')}>
            <option value="">Nenhum</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      {(error || create.error) && <ErrorNote message={error ?? create.error!.message} />}
      <FormFooter pending={create.isPending} submitLabel="Criar lançamento" onCancel={onClose} disabled={values.description.trim() === ''} />
    </form>
  )
}
