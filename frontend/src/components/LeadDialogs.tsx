import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { BRAZILIAN_STATES, SOURCES, STAGES, moveError, stageInfo } from '../lib/domain'
import { brl, dateTimeBR, parseMoney, whatsappUrl } from '../lib/format'
import { useLeadHistory } from '../lib/queries'
import type { Client, Lead, LeadInput, LeadSource, LeadStage, UserLookup } from '../lib/types'
import { Badge, Dialog, ErrorNote, SelectField, TextAreaField, TextField } from './ui'
import { useToast } from './Toast'
import { MessageComposer } from './MessageComposer'
import { ConfirmDialog } from './common'
import { useAuth } from '../auth/AuthContext'

function useInvalidateCrm() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leads'] }),
      queryClient.invalidateQueries({ queryKey: ['lead-history'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
    ])
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : 'Erro inesperado.'
}

// ---------------------------------------------------------------- criar / editar lead

interface LeadFormValues {
  company: string
  contactName: string
  whatsapp: string
  instagram: string
  segment: string
  city: string
  state: string
  source: LeadSource
  nextStep: string
  nextStepDate: string
  estimatedValue: string
  ownerId: string
}

function toForm(lead: Lead | null, defaultOwner: string | null): LeadFormValues {
  return {
    company: lead?.company ?? '',
    contactName: lead?.contactName ?? '',
    whatsapp: lead?.whatsapp ?? '',
    instagram: lead?.instagram ?? '',
    segment: lead?.segment ?? '',
    city: lead?.city ?? '',
    state: lead?.state ?? '',
    source: lead?.source ?? 'ProspeccaoAtiva',
    nextStep: lead?.nextStep ?? '',
    nextStepDate: lead?.nextStepDate?.slice(0, 10) ?? '',
    estimatedValue: lead?.estimatedValue != null ? String(lead.estimatedValue).replace('.', ',') : '',
    ownerId: lead?.ownerId ?? defaultOwner ?? '',
  }
}

interface LeadDialogProps {
  open: boolean
  /** Lead em edição; null abre o formulário de criação. */
  lead: Lead | null
  users: UserLookup[]
  currentUserId: string
  canWrite: boolean
  onClose: () => void
  onMove: (lead: Lead, target: LeadStage) => void
}

export function LeadDialog(props: LeadDialogProps) {
  const { open, lead, onClose } = props
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={lead ? lead.company : 'Novo lead'}
      description={lead ? undefined : 'Cadastre uma empresa para prospectar.'}
    >
      <LeadForm key={lead?.id ?? 'novo'} {...props} />
    </Dialog>
  )
}

function LeadForm({ lead, users, currentUserId, canWrite, onClose, onMove }: LeadDialogProps) {
  const toast = useToast()
  const { isAdmin } = useAuth()
  const invalidate = useInvalidateCrm()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/leads/${lead!.id}`),
    onSuccess: async () => {
      await invalidate()
      toast('Lead excluído definitivamente.')
      onClose()
    },
  })
  const [values, setValues] = useState(() => toForm(lead, currentUserId))
  const [valueError, setValueError] = useState<string | undefined>()
  const history = useLeadHistory(lead?.id ?? null)
  const set = <K extends keyof LeadFormValues>(key: K) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value as LeadFormValues[K] }))

  const save = useMutation({
    mutationFn: (body: LeadInput) =>
      lead ? api.put<Lead>(`/api/leads/${lead.id}`, { ...body, version: lead.version }) : api.post<Lead>('/api/leads', body),
    onSuccess: async () => {
      await invalidate()
      toast(lead ? 'Lead atualizado.' : 'Lead criado.')
      onClose()
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409) {
        await invalidate()
        toast('Este lead foi alterado por outra pessoa. Reabra para ver a versão atual.', 'error')
        onClose()
      }
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const estimatedValue = parseMoney(values.estimatedValue)
    if (values.estimatedValue.trim() !== '' && estimatedValue === null) {
      setValueError('Informe um valor válido, por exemplo 5000 ou 5.000,00.')
      return
    }
    setValueError(undefined)
    const blank = (s: string) => (s.trim() === '' ? null : s.trim())
    save.mutate({
      company: values.company.trim(),
      contactName: blank(values.contactName),
      whatsapp: blank(values.whatsapp),
      instagram: blank(values.instagram),
      segment: blank(values.segment),
      city: blank(values.city),
      state: blank(values.state),
      source: values.source,
      nextStep: blank(values.nextStep),
      nextStepDate: blank(values.nextStepDate),
      estimatedValue,
      ownerId: blank(values.ownerId),
    })
  }

  const wa = whatsappUrl(lead?.whatsapp)
  const userName = (id: string | null) => users.find((u) => u.id === id)?.fullName ?? 'sistema'
  const movable = lead && canWrite && lead.stage !== 'Fechado'

  return (
    <form onSubmit={onSubmit} className="dialog-form">
      {lead && (
        <div className="dialog-meta">
          <Badge tone={stageInfo(lead.stage).tone}>{stageInfo(lead.stage).label}</Badge>
          {lead.stage === 'Perdido' && lead.lostReason && <span className="muted">Motivo: {lead.lostReason}</span>}
          {lead.estimatedValue != null && <span className="muted">Valor estimado {brl(lead.estimatedValue)}</span>}
          {wa && (
            <a className="btn btn-secondary btn-sm" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden /> WhatsApp
            </a>
          )}
        </div>
      )}

      <fieldset disabled={!canWrite || save.isPending} className="form-grid">
        <legend className="sr-only">Dados do lead</legend>
        <div className="span-2">
          <TextField label="Empresa" required maxLength={200} value={values.company} onChange={set('company')} autoFocus={!lead} />
        </div>
        <TextField label="Contato" maxLength={150} value={values.contactName} onChange={set('contactName')} />
        <TextField label="WhatsApp" inputMode="tel" maxLength={30} value={values.whatsapp} onChange={set('whatsapp')} placeholder="(67) 99999-0000" />
        <TextField label="Instagram" maxLength={100} value={values.instagram} onChange={set('instagram')} placeholder="@empresa" />
        <TextField label="Segmento" maxLength={100} value={values.segment} onChange={set('segment')} />
        <TextField label="Cidade" maxLength={100} value={values.city} onChange={set('city')} />
        <SelectField label="UF" value={values.state} onChange={set('state')}>
          <option value="">—</option>
          {BRAZILIAN_STATES.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </SelectField>
        <SelectField label="Origem" value={values.source} onChange={set('source')}>
          {SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Responsável" value={values.ownerId} onChange={set('ownerId')}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </SelectField>
        <TextField label="Valor estimado (R$)" inputMode="decimal" value={values.estimatedValue} onChange={set('estimatedValue')} error={valueError} />
        <TextField label="Data do próximo passo" type="date" value={values.nextStepDate} onChange={set('nextStepDate')} />
        <div className="span-2">
          <TextField label="Próximo passo" maxLength={300} value={values.nextStep} onChange={set('nextStep')} placeholder="Ex.: enviar proposta por WhatsApp" />
        </div>
      </fieldset>

      {save.error && !(save.error instanceof ApiError && save.error.status === 409) && <ErrorNote message={messageOf(save.error)} />}

      {lead && (
        <section className="history" aria-label="Histórico de etapas">
          <h3>Histórico</h3>
          {history.isPending ? (
            <p className="muted small">Carregando…</p>
          ) : history.data && history.data.length > 0 ? (
            <ol>
              {history.data.map((h, i) => (
                <li key={i}>
                  <span>
                    {stageInfo(h.from).label} → <strong>{stageInfo(h.to).label}</strong>
                  </span>
                  <span className="muted small">
                    {dateTimeBR(h.changedAt)} · {userName(h.changedById)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Ainda sem movimentações. Criado em {dateTimeBR(lead.createdAt)}.</p>
          )}
        </section>
      )}

      {lead && canWrite && lead.stage !== 'Fechado' && <MessageComposer lead={lead} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir lead definitivamente?"
        description={lead ? `${lead.company} e o histórico de etapas serão apagados. Esta ação não pode ser desfeita.` : undefined}
        confirmLabel="Excluir definitivamente"
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />

      <footer className="dialog-footer">
        {movable && (
          <label className="move-select">
            <span>Mover para</span>
            <select
              value=""
              onChange={(e) => {
                const target = e.target.value as LeadStage
                if (!target) return
                onClose()
                onMove(lead, target)
              }}
            >
              <option value="">Escolher etapa…</option>
              {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
                <option key={s.key} value={s.key} disabled={moveError(lead.stage, s.key) !== null}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {lead && isAdmin && lead.stage !== 'Fechado' && (
          <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
            Excluir lead
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {canWrite ? 'Cancelar' : 'Fechar'}
        </button>
        {canWrite && (
          <button type="submit" className="btn btn-primary" disabled={save.isPending || values.company.trim() === ''}>
            {save.isPending ? 'Salvando…' : lead ? 'Salvar' : 'Criar lead'}
          </button>
        )}
      </footer>
    </form>
  )
}

// ---------------------------------------------------------------- marcar como perdido

export function LostDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  return (
    <Dialog open={!!lead} onClose={onClose} title="Marcar como perdido" description={lead?.company}>
      {lead && <LostForm key={lead.id} lead={lead} onClose={onClose} />}
    </Dialog>
  )
}

function LostForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast()
  const invalidate = useInvalidateCrm()
  const [reason, setReason] = useState('')
  const lose = useMutation({
    mutationFn: () => api.post<Lead>(`/api/leads/${lead.id}/stage`, { stage: 'Perdido', lostReason: reason.trim(), version: lead.version }),
    onSuccess: async () => {
      await invalidate()
      toast('Lead marcado como perdido.')
      onClose()
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409) await invalidate()
    },
  })
  return (
    <form
      className="dialog-form"
      onSubmit={(e) => {
        e.preventDefault()
        lose.mutate()
      }}
    >
      <TextAreaField label="Motivo da perda" required maxLength={300} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Ex.: sem orçamento no momento" />
      {lose.error && <ErrorNote message={messageOf(lose.error)} />}
      <footer className="dialog-footer">
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-danger" disabled={lose.isPending || reason.trim() === ''}>
          {lose.isPending ? 'Salvando…' : 'Marcar como perdido'}
        </button>
      </footer>
    </form>
  )
}

// ---------------------------------------------------------------- converter em cliente

export function ConvertDialog({ lead, users, onClose }: { lead: Lead | null; users: UserLookup[]; onClose: () => void }) {
  return (
    <Dialog open={!!lead} onClose={onClose} title="Converter em cliente" description={lead ? `${lead.company} vira cliente e o lead é fechado.` : undefined}>
      {lead && <ConvertForm key={lead.id} lead={lead} users={users} onClose={onClose} />}
    </Dialog>
  )
}

function ConvertForm({ lead, users, onClose }: { lead: Lead; users: UserLookup[]; onClose: () => void }) {
  const toast = useToast()
  const invalidate = useInvalidateCrm()
  const [implementation, setImplementation] = useState(lead.estimatedValue != null ? String(lead.estimatedValue).replace('.', ',') : '')
  const [monthly, setMonthly] = useState('')
  const [dueDay, setDueDay] = useState('10')
  const [responsible, setResponsible] = useState(lead.ownerId ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()

  const convert = useMutation({
    mutationFn: (body: { implementationFee: number; monthlyFee: number; dueDay: number; responsibleId: string | null }) =>
      api.post<Client>(`/api/leads/${lead.id}/convert`, body),
    onSuccess: async (client) => {
      await invalidate()
      toast(`${client.name} agora é cliente (em implementação).`)
      onClose()
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409) await invalidate()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const impl = parseMoney(implementation) ?? 0
    const mon = parseMoney(monthly)
    if (mon === null || mon < 0 || impl < 0) {
      setFieldError('Informe a mensalidade (e valores não negativos).')
      return
    }
    setFieldError(undefined)
    convert.mutate({ implementationFee: impl, monthlyFee: mon, dueDay: Number(dueDay), responsibleId: responsible || null })
  }

  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Implementação (R$)" inputMode="decimal" value={implementation} onChange={(e) => setImplementation(e.target.value)} />
        <TextField label="Mensalidade (R$)" inputMode="decimal" required autoFocus value={monthly} onChange={(e) => setMonthly(e.target.value)} error={fieldError} />
        <SelectField label="Dia de vencimento" value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </SelectField>
        <SelectField label="Responsável" value={responsible} onChange={(e) => setResponsible(e.target.value)}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </SelectField>
      </div>
      {convert.error && <ErrorNote message={messageOf(convert.error)} />}
      <footer className="dialog-footer">
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={convert.isPending}>
          {convert.isPending ? 'Convertendo…' : 'Converter em cliente'}
        </button>
      </footer>
    </form>
  )
}
