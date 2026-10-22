import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { PRIORITIES, TODO_STATUSES, priorityInfo, type Tone } from '../lib/domain'
import { brl, dateBR, todayISO } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { usePlanning, useTasks, useUsers } from '../lib/queries'
import type { PlanningItem, Priority, Task, TodoStatus } from '../lib/types'
import { Badge, Dialog, EmptyState, ErrorNote, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, Tabs, blankToNull, useForm } from '../components/common'
import { ClientSelect } from '../components/ClientSelect'

type Tab = 'agenda' | 'tasks'

const KIND_TONE: Record<string, Tone> = { Tarefa: 'brand', 'Follow-up': 'info', Reunião: 'teal', Vencimento: 'warning', Conteúdo: 'neutral' }
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + n))
}

export function PlanningPage() {
  const [tab, setTab] = useState<Tab>('agenda')
  return (
    <>
      <PageHeader title="Planejamento" subtitle="Agenda do que vence nos próximos dias e as tarefas da equipe" />
      <Tabs
        label="Seções do planejamento"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'agenda', label: 'Agenda' },
          { key: 'tasks', label: 'Tarefas' },
        ]}
      />
      {tab === 'agenda' ? <Agenda /> : <Tasks />}
    </>
  )
}

function Agenda() {
  const today = todayISO()
  const [days, setDays] = useState(14)
  const { data, isPending, isError, refetch } = usePlanning(today, addDays(today, days))

  const groups = useMemo(() => {
    const overdue = (data ?? []).filter((i) => i.overdue)
    const byDay = new Map<string, PlanningItem[]>()
    for (const item of (data ?? []).filter((i) => !i.overdue)) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item])
    return { overdue, days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)) }
  }, [data])

  return (
    <>
      <div className="toolbar">
        <label className="field-inline">
          <span className="sr-only">Período</span>
          <select className="select-inline" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Período">
            <option value={7}>Próximos 7 dias</option>
            <option value={14}>Próximos 14 dias</option>
            <option value={30}>Próximos 30 dias</option>
          </select>
        </label>
      </div>
      {isPending ? (
        <p className="loading">Carregando agenda…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar a agenda." onRetry={() => void refetch()} />
      ) : groups.overdue.length === 0 && groups.days.length === 0 ? (
        <EmptyState title="Nada na agenda">Sem tarefas, follow-ups, reuniões, vencimentos ou publicações neste período.</EmptyState>
      ) : (
        <div className="agenda">
          {groups.overdue.length > 0 && <AgendaGroup title="Atrasados" danger items={groups.overdue} />}
          {groups.days.map(([date, items]) => (
            <AgendaGroup key={date} title={date === today ? `Hoje · ${dateBR(date)}` : dateBR(date)} items={items} />
          ))}
        </div>
      )}
    </>
  )
}

function AgendaGroup({ title, items, danger }: { title: string; items: PlanningItem[]; danger?: boolean }) {
  return (
    <section className="agenda-group">
      <h2 className={danger ? 'neg' : undefined}>{title}</h2>
      <ul>
        {items.map((i, idx) => (
          <li key={`${i.kind}-${i.title}-${idx}`}>
            <Badge tone={i.overdue ? 'danger' : (KIND_TONE[i.kind] ?? 'neutral')}>{i.kind}</Badge>
            <Link to={i.link} className="agenda-title">
              {i.title}
            </Link>
            {(i.subtitle || i.amount !== null) && <span className="muted small">{[i.subtitle, i.amount !== null ? brl(i.amount) : null].filter(Boolean).join(' · ')}</span>}
            {i.overdue && <span className="muted small">venceu em {dateBR(i.date)}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------- tarefas

function Tasks() {
  const { user } = useAuth()
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [editing, setEditing] = useState<{ task: Task | null } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const { data, isPending, isError, refetch } = useTasks({ open: onlyOpen || undefined })
  const users = useUsers().data ?? []

  const toggle = useCrmMutation(
    (t: Task) => api.post<Task>(`/api/tasks/${t.id}/status`, { status: t.status === 'Concluida' ? 'Aberta' : 'Concluida', version: t.version }),
    ['tasks', 'planning'],
  )
  const del = useCrmMutation((t: Task) => api.delete(`/api/tasks/${t.id}`), ['tasks', 'planning'], 'Tarefa excluída.', () => setDeleting(null))

  return (
    <>
      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Só abertas
        </label>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ task: null })}>
          <Plus size={18} aria-hidden /> Nova tarefa
        </button>
      </div>
      {isPending ? (
        <p className="loading">Carregando tarefas…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar as tarefas." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma tarefa">Crie tarefas para a equipe e acompanhe os prazos.</EmptyState>
      ) : (
        <ul className="task-list">
          {data.map((t) => {
            const done = t.status === 'Concluida'
            const p = priorityInfo(t.priority)
            return (
              <li key={t.id} className={`task${done || t.status === 'Cancelada' ? ' done' : ''}`}>
                <input type="checkbox" checked={done} disabled={t.status === 'Cancelada' || toggle.isPending} onChange={() => toggle.mutate(t)} aria-label={`Concluir ${t.title}`} />
                <div className="task-main">
                  <strong>{t.title}</strong>
                  <span className="muted small">
                    {[t.clientName, t.type, users.find((u) => u.id === t.assigneeId)?.fullName].filter(Boolean).join(' · ') || 'Sem vínculo'}
                  </span>
                </div>
                <Badge tone={p.tone}>{p.label}</Badge>
                <span className={`task-due small${t.overdue ? ' neg' : ' muted'}`}>{t.dueDate ? `${t.overdue ? 'Venceu ' : ''}${dateBR(t.dueDate)}` : 'Sem prazo'}</span>
                <RowActions label={t.title} onEdit={() => setEditing({ task: t })} onDelete={() => setDeleting(t)} />
              </li>
            )
          })}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.task ? 'Editar tarefa' : 'Nova tarefa'}>
        {editing && <TaskForm key={editing.task?.id ?? 'nova'} task={editing.task} defaultAssignee={user?.id ?? ''} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir tarefa?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function TaskForm({ task, defaultAssignee, onClose }: { task: Task | null; defaultAssignee: string; onClose: () => void }) {
  const users = useUsers().data ?? []
  const { values, bind } = useForm({
    title: task?.title ?? '',
    type: task?.type ?? '',
    dueDate: task?.dueDate ?? '',
    priority: task?.priority ?? 'Media',
    status: task?.status ?? 'Aberta',
    clientId: task?.clientId ?? '',
    assigneeId: task ? (task.assigneeId ?? '') : defaultAssignee,
    notes: task?.notes ?? '',
  })
  const save = useCrmMutation(
    async (body: object) => {
      const saved = task ? await api.put<Task>(`/api/tasks/${task.id}`, { ...body, version: task.version }) : await api.post<Task>('/api/tasks', body)
      // O status não faz parte do corpo de edição: muda por chamada própria, com a versão já atualizada.
      if (task && values.status !== task.status) await api.post(`/api/tasks/${saved.id}/status`, { status: values.status, version: saved.version })
      return saved
    },
    ['tasks', 'planning'],
    'Tarefa salva.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      title: values.title.trim(),
      type: blankToNull(values.type),
      dueDate: blankToNull(values.dueDate),
      priority: values.priority as Priority,
      clientId: blankToNull(values.clientId),
      assigneeId: blankToNull(values.assigneeId),
      notes: blankToNull(values.notes),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <TextField label="Prazo" type="date" {...bind('dueDate')} />
        <SelectField label="Prioridade" {...bind('priority')}>
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Tipo" maxLength={60} placeholder="Ex.: Reunião, Conteúdo, Cobrança" {...bind('type')} />
        {task && (
          <SelectField label="Status" {...bind('status')}>
            {TODO_STATUSES.map((s) => (
              <option key={s.key} value={s.key as TodoStatus}>
                {s.label}
              </option>
            ))}
          </SelectField>
        )}
        <ClientSelect {...bind('clientId')} />
        <SelectField label="Responsável" {...bind('assigneeId')}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </SelectField>
        <div className="span-2">
          <TextAreaField label="Observações" rows={3} maxLength={4000} {...bind('notes')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === ''} />
    </form>
  )
}
