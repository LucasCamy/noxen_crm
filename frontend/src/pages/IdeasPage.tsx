import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { IDEA_STATUSES, PRIORITIES, ideaStatusInfo, priorityInfo } from '../lib/domain'
import { dateBR } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useIdeas } from '../lib/queries'
import type { Idea, IdeaStatus, Priority } from '../lib/types'
import { Badge, Dialog, EmptyState, ErrorNote, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from '../components/common'
import { ClientSelect } from '../components/ClientSelect'

export function IdeasPage() {
  const { data, isPending, isError, refetch } = useIdeas()
  const [editing, setEditing] = useState<{ idea: Idea | null } | null>(null)
  const [deleting, setDeleting] = useState<Idea | null>(null)
  const del = useCrmMutation((i: Idea) => api.delete(`/api/ideas/${i.id}`), ['ideas'], 'Ideia excluída.', () => setDeleting(null))

  return (
    <>
      <PageHeader
        title="Ideias"
        subtitle="Oportunidades e iniciativas para analisar, aprovar e executar"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ idea: null })}>
            <Plus size={18} aria-hidden /> Nova ideia
          </button>
        }
      />
      {isPending ? (
        <p className="loading">Carregando ideias…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar as ideias." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma ideia ainda">Registre ideias de conteúdo, ofertas e melhorias para não perdê-las.</EmptyState>
      ) : (
        <div className="idea-grid">
          {data.map((i) => {
            const st = ideaStatusInfo(i.status)
            const p = priorityInfo(i.priority)
            return (
              <article key={i.id} className={`idea${i.status === 'Descartada' ? ' done' : ''}`}>
                <header>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Badge tone={p.tone}>Prioridade {p.label.toLowerCase()}</Badge>
                  <span className="spacer" />
                  <RowActions label={i.title} onEdit={() => setEditing({ idea: i })} onDelete={() => setDeleting(i)} />
                </header>
                <h2>{i.title}</h2>
                {i.category && <p className="muted small">{[i.category, i.clientName].filter(Boolean).join(' · ')}</p>}
                {i.notes && <p className="pre">{i.notes}</p>}
                {(i.nextStep || i.date) && (
                  <p className="next-steps">
                    <strong>Próximo passo:</strong> {i.nextStep ?? '—'}
                    {i.date && ` · ${dateBR(i.date)}`}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.idea ? 'Editar ideia' : 'Nova ideia'}>
        {editing && <IdeaForm key={editing.idea?.id ?? 'nova'} idea={editing.idea} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir ideia?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function IdeaForm({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const { values, bind } = useForm({
    title: idea?.title ?? '',
    category: idea?.category ?? '',
    priority: idea?.priority ?? 'Media',
    status: idea?.status ?? 'Nova',
    notes: idea?.notes ?? '',
    nextStep: idea?.nextStep ?? '',
    date: idea?.date ?? '',
    clientId: idea?.clientId ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (idea ? api.put(`/api/ideas/${idea.id}`, { ...body, version: idea.version }) : api.post('/api/ideas', body)),
    ['ideas'],
    'Ideia salva.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      title: values.title.trim(),
      category: blankToNull(values.category),
      priority: values.priority as Priority,
      status: values.status as IdeaStatus,
      notes: blankToNull(values.notes),
      nextStep: blankToNull(values.nextStep),
      date: blankToNull(values.date),
      clientId: blankToNull(values.clientId),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <TextField label="Categoria" maxLength={100} placeholder="Ex.: Conteúdo, Oferta, Parceria" {...bind('category')} />
        <SelectField label="Prioridade" {...bind('priority')}>
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" {...bind('status')}>
          {IDEA_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <ClientSelect {...bind('clientId')} />
        <TextField label="Próximo passo" maxLength={500} {...bind('nextStep')} />
        <TextField label="Data" type="date" {...bind('date')} />
        <div className="span-2">
          <TextAreaField label="Detalhes" rows={4} maxLength={4000} {...bind('notes')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === ''} />
    </form>
  )
}
