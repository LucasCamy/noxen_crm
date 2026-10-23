import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { EMPTY, brl, formatDate, fromDateTimeLocal, parseMoney, todayISO, toDateTimeLocal } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useCampaigns, useMeetings, usePayments, useResults } from '../lib/queries'
import type { Campaign, CampaignStatus, Meeting, MonthlyResult } from '../lib/types'
import type { Tone } from '../lib/domain'
import { Badge, CreateButton, DateValue, Dialog, EmptyState, ErrorNote, ListSkeleton, SectionTitle, SelectField, TextAreaField, TextField } from './ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from './common'
import { PaymentFormDialog, PaymentsTable } from './FinanceParts'

export function PanelHead({ title, label, action }: { title: string; label: string; action: () => void }) {
  return (
    <div className="card-head">
      <SectionTitle>{title}</SectionTitle>
      <CreateButton onClick={action}>{label}</CreateButton>
    </div>
  )
}

// ---------------------------------------------------------------- pagamentos

export function PaymentsPanel({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = usePayments({ clientId })
  const [creating, setCreating] = useState(false)
  return (
    <>
      <PanelHead title="Histórico de pagamentos" label="Nova cobrança" action={() => setCreating(true)} />
      {isPending ? (
        <ListSkeleton rows={3} label="Carregando" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os pagamentos." onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Sem cobranças">As mensalidades dos clientes ativos são geradas automaticamente todo mês.</EmptyState>
      ) : (
        <PaymentsTable payments={data.items} showClient={false} canManage />
      )}
      <PaymentFormDialog open={creating} onClose={() => setCreating(false)} clientId={clientId} />
    </>
  )
}

// ---------------------------------------------------------------- reuniões

export function MeetingsPanel({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = useMeetings(clientId)
  const [editing, setEditing] = useState<{ meeting: Meeting | null } | null>(null)
  const [deleting, setDeleting] = useState<Meeting | null>(null)
  const del = useCrmMutation((m: Meeting) => api.delete(`/api/meetings/${m.id}`), ['meetings'], 'Reunião excluída.', () => setDeleting(null))

  return (
    <>
      <PanelHead title="Reuniões" label="Nova reunião" action={() => setEditing({ meeting: null })} />
      {isPending ? (
        <ListSkeleton rows={3} label="Carregando" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar as reuniões." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma reunião registrada">Anote o que foi combinado e os próximos passos.</EmptyState>
      ) : (
        <ul className="timeline">
          {data.map((m) => (
            <li key={m.id}>
              <div className="timeline-head">
                <strong>{m.subject}</strong>
                <span className="muted small"><DateValue value={m.heldAt} mode="datetime" /></span>
                <RowActions label={m.subject} onEdit={() => setEditing({ meeting: m })} onDelete={() => setDeleting(m)} />
              </div>
              {m.notes && <p className="pre">{m.notes}</p>}
              {m.nextSteps && (
                <p className="next-steps">
                  <strong>Próximos passos:</strong> {m.nextSteps}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.meeting ? 'Editar reunião' : 'Nova reunião'}>
        {editing && <MeetingForm key={editing.meeting?.id ?? 'novo'} clientId={clientId} meeting={editing.meeting} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir reunião?" description={deleting?.subject} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function MeetingForm({ clientId, meeting, onClose }: { clientId: string; meeting: Meeting | null; onClose: () => void }) {
  const { values, bind } = useForm(() => ({
    heldAt: toDateTimeLocal(meeting?.heldAt ?? new Date().toISOString()),
    subject: meeting?.subject ?? '',
    notes: meeting?.notes ?? '',
    nextSteps: meeting?.nextSteps ?? '',
  }))
  const save = useCrmMutation(
    (body: object) => (meeting ? api.put(`/api/meetings/${meeting.id}`, { ...body, version: meeting.version }) : api.post(`/api/clients/${clientId}/meetings`, body)),
    ['meetings'],
    'Reunião salva.',
    onClose,
  )
  return (
    <form
      className="dialog-form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        save.mutate({ heldAt: fromDateTimeLocal(values.heldAt), subject: values.subject.trim(), notes: blankToNull(values.notes), nextSteps: blankToNull(values.nextSteps) })
      }}
    >
      <div className="form-grid">
        <TextField label="Data e hora" type="datetime-local" required {...bind('heldAt')} />
        <TextField label="Assunto" required maxLength={200} autoFocus {...bind('subject')} />
        <div className="span-2">
          <TextAreaField label="Anotações" rows={4} maxLength={8000} {...bind('notes')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Próximos passos" rows={3} maxLength={4000} {...bind('nextSteps')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.subject.trim() === ''} />
    </form>
  )
}

// ---------------------------------------------------------------- campanhas

const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = { Planejada: 'info', Ativa: 'success', Pausada: 'warning', Encerrada: 'neutral' }

export function CampaignsPanel({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = useCampaigns(clientId)
  const [editing, setEditing] = useState<{ campaign: Campaign | null } | null>(null)
  const [deleting, setDeleting] = useState<Campaign | null>(null)
  const del = useCrmMutation((c: Campaign) => api.delete(`/api/campaigns/${c.id}`), ['campaigns'], 'Campanha excluída.', () => setDeleting(null))

  return (
    <>
      <PanelHead title="Campanhas" label="Nova campanha" action={() => setEditing({ campaign: null })} />
      {isPending ? (
        <ListSkeleton rows={3} label="Carregando" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar as campanhas." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma campanha">Registre objetivo, público, criativos e verba de cada campanha.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Campanha</th>
                <th scope="col">Status</th>
                <th scope="col">Período</th>
                <th scope="col" className="num">
                  Verba
                </th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name}
                    {c.objective && <span className="muted small block">{c.objective}</span>}
                  </th>
                  <td>
                    <Badge tone={CAMPAIGN_TONE[c.status]}>{c.status}</Badge>
                  </td>
                  <td>
                    {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : 'em aberto'}
                  </td>
                  <td className="num">{brl(c.budget)}</td>
                  <td>
                    <RowActions label={c.name} onEdit={() => setEditing({ campaign: c })} onDelete={() => setDeleting(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.campaign ? 'Editar campanha' : 'Nova campanha'}>
        {editing && <CampaignForm key={editing.campaign?.id ?? 'nova'} clientId={clientId} campaign={editing.campaign} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir campanha?" description={deleting?.name} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function CampaignForm({ clientId, campaign, onClose }: { clientId: string; campaign: Campaign | null; onClose: () => void }) {
  const { values, bind } = useForm({
    name: campaign?.name ?? '',
    status: campaign?.status ?? 'Planejada',
    startDate: campaign?.startDate ?? todayISO(),
    endDate: campaign?.endDate ?? '',
    budget: campaign ? String(campaign.budget).replace('.', ',') : '',
    objective: campaign?.objective ?? '',
    audience: campaign?.audience ?? '',
    creatives: campaign?.creatives ?? '',
  })
  const [error, setError] = useState<string | undefined>()
  const save = useCrmMutation(
    (body: object) => (campaign ? api.put(`/api/campaigns/${campaign.id}`, { ...body, version: campaign.version }) : api.post(`/api/clients/${clientId}/campaigns`, body)),
    ['campaigns'],
    'Campanha salva.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const budget = values.budget.trim() === '' ? 0 : parseMoney(values.budget)
    if (budget === null || budget < 0) return setError('Informe uma verba válida.')
    if (values.endDate && values.endDate < values.startDate) return setError('O fim não pode ser antes do início.')
    setError(undefined)
    save.mutate({
      name: values.name.trim(),
      status: values.status,
      startDate: values.startDate,
      endDate: blankToNull(values.endDate),
      budget,
      objective: blankToNull(values.objective),
      audience: blankToNull(values.audience),
      creatives: blankToNull(values.creatives),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Nome" required maxLength={200} autoFocus {...bind('name')} />
        <SelectField label="Status" {...bind('status')}>
          {(['Planejada', 'Ativa', 'Pausada', 'Encerrada'] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <TextField label="Início" type="date" required {...bind('startDate')} />
        <TextField label="Fim" type="date" {...bind('endDate')} />
        <TextField label="Verba (R$)" inputMode="decimal" {...bind('budget')} />
        <TextField label="Objetivo" maxLength={500} {...bind('objective')} />
        <div className="span-2">
          <TextAreaField label="Público" rows={2} maxLength={1000} {...bind('audience')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Criativos" rows={2} maxLength={2000} {...bind('creatives')} />
        </div>
      </div>
      {(error || save.error) && <ErrorNote message={error ?? save.error!.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.name.trim() === ''} />
    </form>
  )
}

// ---------------------------------------------------------------- resultados

const num = (n: number | null, digits = 2) => (n === null ? EMPTY : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }))

export function ResultsPanel({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = useResults(clientId)
  const [editing, setEditing] = useState<{ result: MonthlyResult | null } | null>(null)
  const [deleting, setDeleting] = useState<MonthlyResult | null>(null)
  const del = useCrmMutation((r: MonthlyResult) => api.delete(`/api/results/${r.id}`), ['results'], 'Resultado excluído.', () => setDeleting(null))

  return (
    <>
      <PanelHead title="Resultados mensais" label="Novo resultado" action={() => setEditing({ result: null })} />
      {isPending ? (
        <ListSkeleton rows={3} label="Carregando" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os resultados." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhum resultado registrado">Informe verba, leads, vendas e faturamento do mês para acompanhar CPL e ROAS.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col" className="num">Verba</th>
                <th scope="col" className="num">Leads</th>
                <th scope="col" className="num">Vendas</th>
                <th scope="col" className="num">Faturamento</th>
                <th scope="col" className="num">CPL</th>
                <th scope="col" className="num">Custo/venda</th>
                <th scope="col" className="num">ROAS</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{formatDate(r.month, 'month')}</th>
                  <td className="num">{brl(r.adSpend)}</td>
                  <td className="num">{r.leads}</td>
                  <td className="num">{r.sales}</td>
                  <td className="num">{brl(r.revenue)}</td>
                  <td className="num">{r.costPerLead === null ? EMPTY : brl(r.costPerLead)}</td>
                  <td className="num">{r.costPerSale === null ? EMPTY : brl(r.costPerSale)}</td>
                  <td className="num">{r.roas === null ? EMPTY : `${num(r.roas)}x`}</td>
                  <td>
                    <RowActions label={`resultado de ${formatDate(r.month, 'month')}`} onEdit={() => setEditing({ result: r })} onDelete={() => setDeleting(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.result ? 'Editar resultado' : 'Novo resultado'}>
        {editing && <ResultForm key={editing.result?.id ?? 'novo'} clientId={clientId} result={editing.result} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir resultado?" description={deleting ? formatDate(deleting.month, 'month') : undefined} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function ResultForm({ clientId, result, onClose }: { clientId: string; result: MonthlyResult | null; onClose: () => void }) {
  const { values, bind } = useForm({
    month: result ? result.month.slice(0, 7) : todayISO().slice(0, 7),
    adSpend: result ? String(result.adSpend).replace('.', ',') : '',
    leads: String(result?.leads ?? 0),
    sales: String(result?.sales ?? 0),
    revenue: result ? String(result.revenue).replace('.', ',') : '',
    notes: result?.notes ?? '',
  })
  const [error, setError] = useState<string | undefined>()
  const save = useCrmMutation(
    (body: object) => (result ? api.put(`/api/results/${result.id}`, { ...body, version: result.version }) : api.post(`/api/clients/${clientId}/results`, body)),
    ['results'],
    'Resultado salvo.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const adSpend = values.adSpend.trim() === '' ? 0 : parseMoney(values.adSpend)
    const revenue = values.revenue.trim() === '' ? 0 : parseMoney(values.revenue)
    if (adSpend === null || revenue === null || adSpend < 0 || revenue < 0) return setError('Informe valores válidos.')
    setError(undefined)
    save.mutate({ month: `${values.month}-01`, adSpend, leads: Number(values.leads) || 0, sales: Number(values.sales) || 0, revenue, notes: blankToNull(values.notes) })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Mês" type="month" required disabled={!!result} {...bind('month')} />
        <TextField label="Verba investida (R$)" inputMode="decimal" {...bind('adSpend')} />
        <TextField label="Leads" type="number" min={0} {...bind('leads')} />
        <TextField label="Vendas" type="number" min={0} {...bind('sales')} />
        <div className="span-2">
          <TextField label="Faturamento atribuído (R$)" inputMode="decimal" {...bind('revenue')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Observações" rows={2} maxLength={2000} {...bind('notes')} />
        </div>
      </div>
      {(error || save.error) && <ErrorNote message={error ?? save.error!.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} />
    </form>
  )
}
