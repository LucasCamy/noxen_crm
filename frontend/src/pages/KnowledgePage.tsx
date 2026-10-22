import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { useCrmMutation } from '../lib/mutations'
import { useKnowledge } from '../lib/queries'
import type { KnowledgeDoc } from '../lib/types'
import { Dialog, EmptyState, ErrorNote, PageHeader, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from '../components/common'

export function KnowledgePage() {
  const { data, isPending, isError, refetch } = useKnowledge()
  const [editing, setEditing] = useState<{ doc: KnowledgeDoc | null } | null>(null)
  const [deleting, setDeleting] = useState<KnowledgeDoc | null>(null)
  const del = useCrmMutation((d: KnowledgeDoc) => api.delete(`/api/knowledge/${d.id}`), ['knowledge'], 'Seção excluída.', () => setDeleting(null))
  const nextOrder = (data?.reduce((max, d) => Math.max(max, d.sortOrder), 0) ?? 0) + 10

  return (
    <>
      <PageHeader
        title="Base estratégica"
        subtitle="Posicionamento, ofertas, tom de voz e decisões da agência"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ doc: null })}>
            <Plus size={18} aria-hidden /> Nova seção
          </button>
        }
      />
      {isPending ? (
        <p className="loading">Carregando…</p>
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar a base." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="A base está vazia">Registre aqui o posicionamento, as ofertas e o tom de voz para toda a equipe consultar.</EmptyState>
      ) : (
        <div className="docs">
          {data.map((d) => (
            <article key={d.id} className="doc">
              <header>
                <h2>{d.title}</h2>
                <RowActions label={d.title} onEdit={() => setEditing({ doc: d })} onDelete={() => setDeleting(d)} />
              </header>
              <p className="pre doc-body">{d.body}</p>
              {d.source && <p className="muted small">Fonte: {d.source}</p>}
            </article>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.doc ? 'Editar seção' : 'Nova seção'}>
        {editing && <DocForm key={editing.doc?.id ?? 'nova'} doc={editing.doc} nextOrder={nextOrder} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir seção?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function DocForm({ doc, nextOrder, onClose }: { doc: KnowledgeDoc | null; nextOrder: number; onClose: () => void }) {
  const { values, bind } = useForm({
    title: doc?.title ?? '',
    body: doc?.body ?? '',
    source: doc?.source ?? '',
    sortOrder: String(doc?.sortOrder ?? nextOrder),
  })
  const save = useCrmMutation(
    (body: object) => (doc ? api.put(`/api/knowledge/${doc.id}`, { ...body, version: doc.version }) : api.post('/api/knowledge', body)),
    ['knowledge'],
    'Seção salva.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ title: values.title.trim(), body: values.body.trim(), source: blankToNull(values.source), sortOrder: Number(values.sortOrder) || 0 })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <div className="span-2">
          <TextAreaField label="Conteúdo" required rows={10} maxLength={20000} {...bind('body')} />
        </div>
        <TextField label="Fonte" maxLength={300} placeholder="De onde veio a informação" {...bind('source')} />
        <TextField label="Ordem" type="number" hint="Menor aparece primeiro" {...bind('sortOrder')} />
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === '' || values.body.trim() === ''} />
    </form>
  )
}
