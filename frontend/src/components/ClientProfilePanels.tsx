import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { ACCESS_COLUMNS } from '../lib/columns'
import { STUDIO_STATUSES, contentStatusInfo, priorityInfo, studioKindLabel } from '../lib/domain'
import { EMPTY, parseMoney } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useAccesses, useContents, useStudioProjects, useTasks } from '../lib/queries'
import type { ClientAccess, ClientProfile, ClientProfileInput } from '../lib/types'
import { Badge, Button, DateValue, Dialog, EmptyState, ErrorNote, TableHead, TableSkeleton, TextAreaField, TextField } from './ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from './common'
import { PanelHead } from './ClientPanels'
import { AgendaSkeleton } from './skeletons'

// ---------------------------------------------------------------- perfil (presença, negócio, marketing)

type ProfileValues = Record<Exclude<keyof ClientProfileInput, 'adBudget'>, string> & { adBudget: string }

const toValues = (p: ClientProfile): ProfileValues => ({
  website: p.website ?? '',
  instagram: p.instagram ? `@${p.instagram}` : '',
  facebook: p.facebook ?? '',
  tikTok: p.tikTok ?? '',
  whatTheySell: p.whatTheySell ?? '',
  idealCustomer: p.idealCustomer ?? '',
  differentiators: p.differentiators ?? '',
  competitors: p.competitors ?? '',
  seasonality: p.seasonality ?? '',
  mainGoal: p.mainGoal ?? '',
  needs: p.needs ?? '',
  toneOfVoice: p.toneOfVoice ?? '',
  contentPillars: p.contentPillars ?? '',
  whatWorked: p.whatWorked ?? '',
  adBudget: p.adBudget === null ? '' : String(p.adBudget).replace('.', ','),
})

/** Ficha de negócio e marketing do cliente. A mesma tela serve para ver e editar; quem pode escrever vê o botão Salvar. */
export function ProfilePanel({ profile }: { profile: ClientProfile }) {
  const { values, bind } = useForm(toValues(profile))
  const [budgetError, setBudgetError] = useState<string | undefined>()
  const save = useCrmMutation(
    (body: ClientProfileInput) => api.put<ClientProfile>(`/api/clients/${profile.clientId}/profile`, { ...body, version: profile.version }),
    ['client-profile'],
    'Perfil salvo.',
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const budget = parseMoney(values.adBudget)
    if (values.adBudget.trim() !== '' && (budget === null || budget < 0)) {
      setBudgetError('Informe um valor em reais.')
      return
    }
    setBudgetError(undefined)
    save.mutate({
      website: blankToNull(values.website),
      instagram: blankToNull(values.instagram),
      facebook: blankToNull(values.facebook),
      tikTok: blankToNull(values.tikTok),
      whatTheySell: blankToNull(values.whatTheySell),
      idealCustomer: blankToNull(values.idealCustomer),
      differentiators: blankToNull(values.differentiators),
      competitors: blankToNull(values.competitors),
      seasonality: blankToNull(values.seasonality),
      mainGoal: blankToNull(values.mainGoal),
      needs: blankToNull(values.needs),
      toneOfVoice: blankToNull(values.toneOfVoice),
      contentPillars: blankToNull(values.contentPillars),
      whatWorked: blankToNull(values.whatWorked),
      adBudget: budget,
    })
  }

  const conflict = save.error instanceof ApiError && save.error.status === 409

  return (
    <form className="dialog-form" onSubmit={onSubmit} noValidate>
      <fieldset className="form-grid" disabled={save.isPending}>
        <legend className="sr-only">Perfil do cliente</legend>
        <h3 className="form-section first">Presença online</h3>
        <TextField label="Site" maxLength={300} placeholder="empresa.com.br" {...bind('website')} />
        <TextField label="Instagram" maxLength={300} placeholder="@usuario" {...bind('instagram')} />
        <TextField label="Facebook" maxLength={300} placeholder="facebook.com/pagina" {...bind('facebook')} />
        <TextField label="TikTok" maxLength={300} placeholder="tiktok.com/@usuario" {...bind('tikTok')} />

        <h3 className="form-section">Negócio</h3>
        <div className="span-2">
          <TextAreaField label="O que vende (produtos, serviços e ticket médio)" rows={3} maxLength={2000} {...bind('whatTheySell')} />
        </div>
        <TextAreaField label="Cliente ideal" rows={3} maxLength={1000} {...bind('idealCustomer')} />
        <TextAreaField label="Sazonalidade (meses fortes e fracos)" rows={3} maxLength={1000} {...bind('seasonality')} />
        <TextAreaField label="Diferenciais" rows={3} maxLength={2000} {...bind('differentiators')} />
        <TextAreaField label="Concorrentes" rows={3} maxLength={2000} {...bind('competitors')} />

        <h3 className="form-section">Marketing</h3>
        <div className="span-2">
          <TextField label="Objetivo principal" maxLength={500} placeholder="Ex.: leads no WhatsApp, vendas, agenda cheia" {...bind('mainGoal')} />
        </div>
        <TextAreaField label="Necessidades" rows={3} maxLength={2000} {...bind('needs')} />
        <TextAreaField label="Tom de voz da marca" rows={3} maxLength={1000} {...bind('toneOfVoice')} />
        <TextAreaField label="Pilares de conteúdo" rows={3} maxLength={1000} {...bind('contentPillars')} />
        <TextAreaField label="O que já funcionou e o que não" rows={3} maxLength={2000} {...bind('whatWorked')} />
        <TextField label="Verba mensal de anúncios (R$)" inputMode="decimal" error={budgetError} {...bind('adBudget')} />
      </fieldset>

      {conflict ? (
        <ErrorNote message="Este perfil foi alterado por outra pessoa. Os dados foram recarregados; revise e salve de novo." />
      ) : save.error ? (
        <ErrorNote message={save.error.message} />
      ) : null}

      <footer className="dialog-footer">
        <span className="muted small">{profile.updatedAt ? 'Última gravação registrada.' : 'Ainda não preenchido.'}</span>
        <span className="spacer" />
        <Button type="submit" variant="primary" loading={save.isPending}>
          Salvar perfil
        </Button>
      </footer>
    </form>
  )
}

// ---------------------------------------------------------------- acessos às plataformas (sem senhas)

export function AccessesPanel({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = useAccesses(clientId)
  const [editing, setEditing] = useState<{ access: ClientAccess | null } | null>(null)
  const [deleting, setDeleting] = useState<ClientAccess | null>(null)
  const del = useCrmMutation((a: ClientAccess) => api.delete(`/api/accesses/${a.id}`), ['accesses'], 'Acesso removido.', () => setDeleting(null))

  return (
    <>
      <PanelHead title="Acessos às plataformas" label="Novo acesso" action={() => setEditing({ access: null })} />
      <p className="muted small">Não escreva senhas aqui. Registre só o que existe e onde a senha está guardada (por exemplo, "gerenciador de senhas, item X").</p>
      {isPending ? (
        <TableSkeleton columns={ACCESS_COLUMNS} rows={3} label="Carregando acessos" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os acessos." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhum acesso registrado">Anote Meta Business Manager, Instagram, Facebook, TikTok, WhatsApp Business e site, com quem concedeu e quando.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Acessos do cliente</caption>
            <TableHead columns={ACCESS_COLUMNS} />
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    {a.platform}
                    {a.note && <span className="muted small block">{a.note}</span>}
                  </th>
                  <td>{a.account ?? EMPTY}</td>
                  <td>{a.accessType ?? EMPTY}</td>
                  <td>{a.passwordLocation ?? EMPTY}</td>
                  <td className="num">
                    <DateValue value={a.grantedOn} />
                  </td>
                  <td className="row-actions">
                    <RowActions label={a.platform} onEdit={() => setEditing({ access: a })} onDelete={() => setDeleting(a)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.access ? 'Editar acesso' : 'Novo acesso'}>
        {editing && <AccessForm key={editing.access?.id ?? 'novo'} clientId={clientId} access={editing.access} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title="Remover acesso?"
        description={deleting?.platform}
        confirmLabel="Remover"
        danger
        busy={del.isPending}
        error={del.error?.message}
        onConfirm={() => deleting && del.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function AccessForm({ clientId, access, onClose }: { clientId: string; access: ClientAccess | null; onClose: () => void }) {
  const { values, bind } = useForm({
    platform: access?.platform ?? '',
    account: access?.account ?? '',
    accessType: access?.accessType ?? '',
    passwordLocation: access?.passwordLocation ?? '',
    grantedOn: access?.grantedOn ?? '',
    note: access?.note ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (access ? api.put(`/api/accesses/${access.id}`, { ...body, version: access.version }) : api.post(`/api/clients/${clientId}/accesses`, body)),
    ['accesses'],
    'Acesso salvo.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      platform: values.platform.trim(),
      account: blankToNull(values.account),
      accessType: blankToNull(values.accessType),
      passwordLocation: blankToNull(values.passwordLocation),
      grantedOn: blankToNull(values.grantedOn),
      note: blankToNull(values.note),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Plataforma" required maxLength={100} autoFocus placeholder="Meta Business Manager, Instagram, site…" {...bind('platform')} />
        </div>
        <TextField label="Conta ou login" maxLength={200} {...bind('account')} />
        <TextField label="Tipo de acesso" maxLength={100} placeholder="Parceiro, administrador…" {...bind('accessType')} />
        <div className="span-2">
          <TextField label="Onde está a senha" maxLength={200} hint="Nunca a senha em si: só o lugar (gerenciador, item X) ou 'não precisa de senha'." {...bind('passwordLocation')} />
        </div>
        <TextField label="Concedido em" type="date" {...bind('grantedOn')} />
        <TextField label="Observação" maxLength={500} {...bind('note')} />
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.platform.trim() === ''} />
    </form>
  )
}

// ---------------------------------------------------------------- entregas: conteúdos, tarefas e projetos do cliente

export function DeliveriesPanel({ clientId }: { clientId: string }) {
  const contents = useContents({ clientId })
  const tasks = useTasks({ clientId })
  const projects = useStudioProjects()
  const clientProjects = (projects.data ?? []).filter((p) => p.clientId === clientId)

  if (contents.isPending || tasks.isPending || projects.isPending) return <AgendaSkeleton groups={3} />
  if (contents.isError || tasks.isError || projects.isError)
    return <ErrorNote message="Não foi possível carregar as entregas." onRetry={() => void Promise.all([contents.refetch(), tasks.refetch(), projects.refetch()])} />

  return (
    <div className="agenda">
      <section className="agenda-group">
        <h2 className="group-label">Conteúdos</h2>
        {contents.data.length === 0 ? (
          <p className="muted small">Nenhum conteúdo para este cliente. <Link to="/contents">Abrir conteúdos</Link></p>
        ) : (
          <ul>
            {contents.data.map((c) => {
              const st = contentStatusInfo(c.status)
              return (
                <li key={c.id}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Link to="/contents" className="agenda-title">
                    {c.title}
                  </Link>
                  <span className="muted small">
                    {[c.channel, c.objective].filter(Boolean).join(' · ')}
                    {c.publishDate && (
                      <>
                        {' · '}
                        <DateValue value={c.publishDate} />
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="agenda-group">
        <h2 className="group-label">Tarefas</h2>
        {tasks.data.length === 0 ? (
          <p className="muted small">Nenhuma tarefa para este cliente. <Link to="/planning">Abrir planejamento</Link></p>
        ) : (
          <ul>
            {tasks.data.map((t) => {
              const p = priorityInfo(t.priority)
              const done = t.status === 'Concluida' || t.status === 'Cancelada'
              return (
                <li key={t.id}>
                  <Badge tone={done ? 'neutral' : p.tone}>{done ? 'Concluída' : p.label}</Badge>
                  <Link to="/planning" className="agenda-title">
                    {t.title}
                  </Link>
                  <span className={`small ${t.overdue ? 'neg' : 'muted'}`}>{t.dueDate ? <DateValue value={t.dueDate} mode="due" /> : 'Sem prazo'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="agenda-group">
        <h2 className="group-label">Projetos criativos</h2>
        {clientProjects.length === 0 ? (
          <p className="muted small">Nenhum projeto para este cliente. <Link to="/studio">Abrir estúdio</Link></p>
        ) : (
          <ul>
            {clientProjects.map((p) => {
              const st = STUDIO_STATUSES.find((s) => s.key === p.status)!
              return (
                <li key={p.id}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Link to="/studio" className="agenda-title">
                    {p.title}
                  </Link>
                  <span className="muted small">
                    {studioKindLabel(p.kind)}
                    {p.dueDate && (
                      <>
                        {' · entrega '}
                        <DateValue value={p.dueDate} />
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

