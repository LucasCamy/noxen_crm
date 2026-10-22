import { useState, type FormEvent } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { STUDIO_KINDS, STUDIO_STATUSES, studioKindLabel } from '../lib/domain'
import { dateBR, safeUrl } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useBrandKits, useReferences, useStudioProjects } from '../lib/queries'
import type { BrandKit, ReferenceLink, StudioKind, StudioProject, StudioStatus } from '../lib/types'
import { Badge, Dialog, EmptyState, ErrorNote, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, Tabs, blankToNull, useForm } from '../components/common'
import { ClientSelect } from '../components/ClientSelect'
import { useDebounced } from '../lib/useDebounced'
import { useToast } from '../components/Toast'

type Tab = 'projects' | 'kits' | 'references'

export function StudioPage() {
  const [tab, setTab] = useState<Tab>('projects')
  return (
    <>
      <PageHeader title="Estúdio criativo" subtitle="Projetos, kits de marca e referências visuais (por link; envio de arquivos ainda não existe)" />
      <Tabs
        label="Seções do estúdio"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'projects', label: 'Projetos' },
          { key: 'kits', label: 'Kits de marca' },
          { key: 'references', label: 'Referências' },
        ]}
      />
      {tab === 'projects' && <Projects />}
      {tab === 'kits' && <Kits />}
      {tab === 'references' && <References />}
    </>
  )
}

function SectionBar({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="toolbar">
      <span className="spacer" />
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={18} aria-hidden /> {label}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- projetos

function Projects() {
  const { data, isPending, isError, refetch } = useStudioProjects()
  const [editing, setEditing] = useState<{ project: StudioProject | null } | null>(null)
  const [deleting, setDeleting] = useState<StudioProject | null>(null)
  const del = useCrmMutation((p: StudioProject) => api.delete(`/api/studio/projects/${p.id}`), ['studio-projects'], 'Projeto excluído.', () => setDeleting(null))

  return (
    <>
      <SectionBar label="Novo projeto" onAdd={() => setEditing({ project: null })} />
      {isPending ? (
        <p className="loading">Carregando projetos…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      ) : (
        <div className="board studio-board" role="group" aria-label="Projetos por status">
          {STUDIO_STATUSES.map((st) => {
            const items = data.filter((p) => p.status === st.key)
            return (
              <section key={st.key} className="column" aria-label={`${st.label}, ${items.length} projetos`}>
                <header className="column-head">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="column-count">{items.length}</span>
                </header>
                <div className="column-body">
                  {items.length === 0 && <p className="column-empty">Nenhum projeto</p>}
                  {items.map((p) => (
                    <article key={p.id} className="lead-card studio-card">
                      <strong className="lead-company">{p.title}</strong>
                      <span className="lead-meta">{[studioKindLabel(p.kind), p.clientName ?? 'Noxen'].join(' · ')}</span>
                      {p.dueDate && <span className="lead-meta">Entrega: {dateBR(p.dueDate)}</span>}
                      <RowActions label={p.title} onEdit={() => setEditing({ project: p })} onDelete={() => setDeleting(p)} />
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.project ? 'Editar projeto' : 'Novo projeto'}>
        {editing && <ProjectForm key={editing.project?.id ?? 'novo'} project={editing.project} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir projeto?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function ProjectForm({ project, onClose }: { project: StudioProject | null; onClose: () => void }) {
  const { values, bind } = useForm({
    title: project?.title ?? '',
    kind: project?.kind ?? 'Imagem',
    status: project?.status ?? 'Briefing',
    clientId: project?.clientId ?? '',
    dueDate: project?.dueDate ?? '',
    brief: project?.brief ?? '',
    visualDirection: project?.visualDirection ?? '',
    storyboard: project?.storyboard ?? '',
    deliverables: project?.deliverables ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (project ? api.put(`/api/studio/projects/${project.id}`, { ...body, version: project.version }) : api.post('/api/studio/projects', body)),
    ['studio-projects'],
    'Projeto salvo.',
    onClose,
  )
  const needsBrief = values.status !== 'Briefing' && values.brief.trim() === ''
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      title: values.title.trim(),
      kind: values.kind as StudioKind,
      status: values.status as StudioStatus,
      clientId: blankToNull(values.clientId),
      dueDate: blankToNull(values.dueDate),
      brief: blankToNull(values.brief),
      visualDirection: blankToNull(values.visualDirection),
      storyboard: blankToNull(values.storyboard),
      deliverables: blankToNull(values.deliverables),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <SelectField label="Tipo" {...bind('kind')}>
          {STUDIO_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" {...bind('status')}>
          {STUDIO_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <ClientSelect label="Cliente (vazio = a própria Noxen)" {...bind('clientId')} />
        <TextField label="Entrega" type="date" {...bind('dueDate')} />
        <div className="span-2">
          <TextAreaField label="Briefing" rows={4} maxLength={8000} {...bind('brief')} error={needsBrief ? 'Preencha o briefing para sair da etapa de briefing.' : undefined} />
        </div>
        <div className="span-2">
          <TextAreaField label="Direção visual" rows={3} maxLength={4000} hint="Paleta, tipografia, estilo e o que evitar" {...bind('visualDirection')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Storyboard / roteiro de cenas" rows={4} maxLength={8000} {...bind('storyboard')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Entregas e links" rows={3} maxLength={4000} {...bind('deliverables')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === '' || needsBrief} />
    </form>
  )
}

// ---------------------------------------------------------------- kits de marca

function Kits() {
  const toast = useToast()
  const { data, isPending, isError, refetch } = useBrandKits()
  const [editing, setEditing] = useState<{ kit: BrandKit | null } | null>(null)
  const [deleting, setDeleting] = useState<BrandKit | null>(null)
  const del = useCrmMutation((k: BrandKit) => api.delete(`/api/studio/kits/${k.id}`), ['studio-kits'], 'Kit excluído.', () => setDeleting(null))

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      toast(`${hex} copiada.`)
    } catch {
      toast('Não foi possível copiar a cor.', 'error')
    }
  }

  return (
    <>
      <SectionBar label="Novo kit" onAdd={() => setEditing({ kit: null })} />
      {isPending ? (
        <p className="loading">Carregando kits…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os kits." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhum kit de marca">Guarde cores, fontes e tom de voz de cada cliente para criar com consistência.</EmptyState>
      ) : (
        <div className="idea-grid">
          {data.map((k) => {
            const logo = safeUrl(k.logoUrl)
            return (
              <article key={k.id} className="idea">
                <header>
                  <h2>{k.name}</h2>
                  <RowActions label={k.name} onEdit={() => setEditing({ kit: k })} onDelete={() => setDeleting(k)} />
                </header>
                <p className="muted small">{k.clientName ?? 'Noxen'}</p>
                {k.colors.length > 0 && (
                  <ul className="swatches" aria-label="Cores">
                    {k.colors.map((c) => (
                      <li key={c}>
                        <button type="button" className="swatch" style={{ background: c }} aria-label={`Copiar cor ${c}`} title={c} onClick={() => void copy(c)} />
                      </li>
                    ))}
                  </ul>
                )}
                {k.fonts && <p className="small"><strong>Fontes:</strong> {k.fonts}</p>}
                {k.tone && <p className="pre small">{k.tone}</p>}
                {k.elements && <p className="pre small">{k.elements}</p>}
                {logo && (
                  <a className="small" href={logo} target="_blank" rel="noopener noreferrer">
                    Ver logo <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.kit ? 'Editar kit' : 'Novo kit de marca'}>
        {editing && <KitForm key={editing.kit?.id ?? 'novo'} kit={editing.kit} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir kit?" description={deleting?.name} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function KitForm({ kit, onClose }: { kit: BrandKit | null; onClose: () => void }) {
  const { values, bind } = useForm({
    name: kit?.name ?? '',
    clientId: kit?.clientId ?? '',
    colors: kit?.colors.join(', ') ?? '',
    fonts: kit?.fonts ?? '',
    tone: kit?.tone ?? '',
    elements: kit?.elements ?? '',
    logoUrl: kit?.logoUrl ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (kit ? api.put(`/api/studio/kits/${kit.id}`, { ...body, version: kit.version }) : api.post('/api/studio/kits', body)),
    ['studio-kits'],
    'Kit salvo.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      name: values.name.trim(),
      clientId: blankToNull(values.clientId),
      colors: blankToNull(values.colors),
      fonts: blankToNull(values.fonts),
      tone: blankToNull(values.tone),
      elements: blankToNull(values.elements),
      logoUrl: blankToNull(values.logoUrl),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Nome" required maxLength={200} autoFocus {...bind('name')} />
        <ClientSelect label="Cliente (vazio = a própria Noxen)" {...bind('clientId')} />
        <div className="span-2">
          <TextField label="Cores" maxLength={200} hint="Hexadecimais separados por vírgula. Ex.: #5B3AE8, #0F172A" {...bind('colors')} />
        </div>
        <TextField label="Fontes" maxLength={500} {...bind('fonts')} />
        <TextField label="Link do logo" type="url" maxLength={1000} placeholder="https://…" {...bind('logoUrl')} />
        <div className="span-2">
          <TextAreaField label="Tom de voz" rows={3} maxLength={2000} {...bind('tone')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Elementos de marca" rows={3} maxLength={2000} {...bind('elements')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.name.trim() === ''} />
    </form>
  )
}

// ---------------------------------------------------------------- referências

function References() {
  const [tagText, setTagText] = useState('')
  const tag = useDebounced(tagText.trim())
  const { data, isPending, isError, refetch } = useReferences(tag)
  const [editing, setEditing] = useState<{ ref: ReferenceLink | null } | null>(null)
  const [deleting, setDeleting] = useState<ReferenceLink | null>(null)
  const del = useCrmMutation((r: ReferenceLink) => api.delete(`/api/studio/references/${r.id}`), ['studio-references'], 'Referência excluída.', () => setDeleting(null))

  return (
    <>
      <div className="toolbar">
        <input className="select-inline" type="search" placeholder="Filtrar por tag" aria-label="Filtrar por tag" value={tagText} onChange={(e) => setTagText(e.target.value)} />
        <span className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ ref: null })}>
          <Plus size={18} aria-hidden /> Nova referência
        </button>
      </div>
      {isPending ? (
        <p className="loading">Carregando referências…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar as referências." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Nenhuma referência">{tag ? 'Nenhuma referência com essa tag.' : 'Salve links de inspiração (anúncios, perfis, moodboards).'}</EmptyState>
      ) : (
        <ul className="timeline">
          {data.map((r) => {
            const url = safeUrl(r.url)
            return (
              <li key={r.id}>
                <div className="timeline-head">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <strong>{r.title}</strong> <ExternalLink size={14} aria-hidden />
                    </a>
                  ) : (
                    <strong>{r.title}</strong>
                  )}
                  <span className="spacer" />
                  <RowActions label={r.title} onEdit={() => setEditing({ ref: r })} onDelete={() => setDeleting(r)} />
                </div>
                <p className="muted small">{[r.clientName, r.tags].filter(Boolean).join(' · ') || 'Sem tags'}</p>
                {r.note && <p className="pre small">{r.note}</p>}
              </li>
            )
          })}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.ref ? 'Editar referência' : 'Nova referência'}>
        {editing && <ReferenceForm key={editing.ref?.id ?? 'nova'} reference={editing.ref} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir referência?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function ReferenceForm({ reference, onClose }: { reference: ReferenceLink | null; onClose: () => void }) {
  const { values, bind } = useForm({
    title: reference?.title ?? '',
    url: reference?.url ?? '',
    tags: reference?.tags ?? '',
    clientId: reference?.clientId ?? '',
    note: reference?.note ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (reference ? api.put(`/api/studio/references/${reference.id}`, { ...body, version: reference.version }) : api.post('/api/studio/references', body)),
    ['studio-references'],
    'Referência salva.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ title: values.title.trim(), url: values.url.trim(), tags: blankToNull(values.tags), clientId: blankToNull(values.clientId), note: blankToNull(values.note) })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <div className="span-2">
          <TextField label="Link" type="url" required maxLength={1000} placeholder="https://…" {...bind('url')} />
        </div>
        <TextField label="Tags" maxLength={300} placeholder="branding, anúncio" {...bind('tags')} />
        <ClientSelect {...bind('clientId')} />
        <div className="span-2">
          <TextAreaField label="Anotação" rows={3} maxLength={2000} {...bind('note')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === '' || values.url.trim() === ''} />
    </form>
  )
}
