import { useState, type FormEvent } from 'react'
import { FilmSlate } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES, contentFormatLabel, contentStatusInfo } from '../lib/domain'
import { CONTENT_COLUMNS } from '../lib/columns'
import { EMPTY } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useContents } from '../lib/queries'
import { matches } from '../lib/search'
import type { ContentFormat, ContentItem, ContentStatus } from '../lib/types'
import { Badge, CreateButton, DateValue, Dialog, EmptyState, ErrorNote, FilterBar, FilterSelect, PageHeader, SearchInput, Segmented, SelectField, TableHead, TableSkeleton, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from '../components/common'
import { ClientSelect } from '../components/ClientSelect'

export function ContentsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ContentStatus | ''>('')
  const [channel, setChannel] = useState('')
  const [editing, setEditing] = useState<{ item: ContentItem | null } | null>(null)
  const [deleting, setDeleting] = useState<ContentItem | null>(null)
  const { data, isPending, isError, refetch } = useContents({ status: status || undefined, channel: channel || undefined })
  const visible = (data ?? []).filter((c) => matches(q, c.title, c.body, c.objective, c.clientName))
  const filtered = !!(q.trim() || status || channel)
  const del = useCrmMutation((c: ContentItem) => api.delete(`/api/contents/${c.id}`), ['contents', 'planning'], 'Conteúdo excluído.', () => setDeleting(null))

  return (
    <>
      <PageHeader
        title="Conteúdos"
        subtitle="Posts, roteiros e anúncios, do rascunho à publicação"
        actions={<CreateButton onClick={() => setEditing({ item: null })}>Novo conteúdo</CreateButton>}
      />
      <FilterBar>
        <SearchInput label="Buscar conteúdos" placeholder="Buscar título ou texto" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented label="Filtrar por status" value={status} onChange={setStatus} options={[{ key: '' as const, label: 'Todos' }, ...CONTENT_STATUSES.map((s) => ({ key: s.key, label: s.label }))]} />
        <FilterSelect label="Filtrar por canal" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos os canais</option>
          {CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
      </FilterBar>
      {isPending ? (
        <TableSkeleton columns={CONTENT_COLUMNS} rows={5} label="Carregando conteúdos" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os conteúdos." onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FilmSlate}
          title="Nenhum conteúdo encontrado"
          action={
            filtered ? undefined : <CreateButton onClick={() => setEditing({ item: null })}>Novo conteúdo</CreateButton>
          }
        >
          {filtered ? 'Ajuste a busca ou os filtros.' : 'Cadastre o primeiro post, roteiro ou anúncio.'}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <TableHead columns={CONTENT_COLUMNS} />
            <tbody>
              {visible.map((c) => {
                const st = contentStatusInfo(c.status)
                return (
                  <tr key={c.id}>
                    <th scope="row">
                      {c.title}
                      <span className="muted small block">{[contentFormatLabel(c.format), c.objective].filter(Boolean).join(' · ')}</span>
                    </th>
                    <td>{c.clientName ?? 'Noxen'}</td>
                    <td>{c.channel ?? EMPTY}</td>
                    <td className="num">
                      <DateValue value={c.publishDate} />
                    </td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="row-actions">
                      <RowActions label={c.title} onEdit={() => setEditing({ item: c })} onDelete={() => setDeleting(c)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.item ? 'Editar conteúdo' : 'Novo conteúdo'}>
        {editing && <ContentForm key={editing.item?.id ?? 'novo'} item={editing.item} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir conteúdo?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
    </>
  )
}

function ContentForm({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  const { values, bind } = useForm({
    title: item?.title ?? '',
    format: item?.format ?? 'Post',
    status: item?.status ?? 'Ideia',
    channel: item?.channel ?? '',
    objective: item?.objective ?? '',
    publishDate: item?.publishDate ?? '',
    clientId: item?.clientId ?? '',
    body: item?.body ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (item ? api.put(`/api/contents/${item.id}`, { ...body, version: item.version }) : api.post('/api/contents', body)),
    ['contents', 'planning'],
    'Conteúdo salvo.',
    onClose,
  )
  const needsDate = values.status === 'Agendado' && values.publishDate === ''
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      title: values.title.trim(),
      format: values.format as ContentFormat,
      status: values.status as ContentStatus,
      channel: blankToNull(values.channel),
      objective: blankToNull(values.objective),
      publishDate: blankToNull(values.publishDate),
      clientId: blankToNull(values.clientId),
      body: blankToNull(values.body),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <SelectField label="Formato" {...bind('format')}>
          {CONTENT_FORMATS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" {...bind('status')}>
          {CONTENT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Canal" {...bind('channel')}>
          <option value="">—</option>
          {CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <TextField label="Data de publicação" type="date" {...bind('publishDate')} error={needsDate ? 'Informe a data para agendar.' : undefined} />
        <TextField label="Objetivo" maxLength={500} placeholder="Ex.: gerar leads no WhatsApp" {...bind('objective')} />
        <ClientSelect label="Cliente (vazio = a própria Noxen)" {...bind('clientId')} />
        <div className="span-2">
          <TextAreaField label="Roteiro / legenda" rows={6} maxLength={20000} {...bind('body')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === '' || needsDate} />
    </form>
  )
}
