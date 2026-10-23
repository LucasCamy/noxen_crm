import { useRef, useState, type FormEvent } from 'react'
import { ChatText, Copy } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { SCRIPT_STAGES } from '../lib/domain'
import { useCrmMutation } from '../lib/mutations'
import { useScripts } from '../lib/queries'
import { matches } from '../lib/search'
import { useScrollReveal } from '../motion/hooks'
import type { ScriptStage, ScriptTemplate } from '../lib/types'
import {
  Button,
  Card,
  CreateButton,
  Dialog,
  EmptyState,
  ErrorNote,
  FilterBar,
  FilterSelect,
  ICON,
  ItemTitle,
  PageHeader,
  SearchInput,
  SectionTitle,
  SelectField,
  TextAreaField,
  TextField,
} from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from '../components/common'
import { ScriptGroupsSkeleton } from '../components/skeletons'
import { useToast } from '../components/Toast'

export function ScriptsPage() {
  const toast = useToast()
  const { data, isPending, isError, refetch } = useScripts()
  const [editing, setEditing] = useState<{ script: ScriptTemplate | null } | null>(null)
  const [deleting, setDeleting] = useState<ScriptTemplate | null>(null)
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<ScriptStage | ''>('')
  const [channel, setChannel] = useState('')
  const channels = [...new Set((data ?? []).map((s) => s.channel).filter((c): c is string => !!c))].sort()
  const visible = (data ?? []).filter((s) => (!stage || s.stage === stage) && (!channel || s.channel === channel) && matches(q, s.title, s.body, s.usage, s.niche))
  const filtered = !!(q.trim() || stage || channel)
  const listRef = useRef<HTMLDivElement>(null)
  useScrollReveal(listRef, '.card', visible.length)
  const del = useCrmMutation(
    (s: ScriptTemplate) => api.delete(`/api/scripts/${s.id}`),
    ['scripts'],
    'Script excluído.',
    () => setDeleting(null),
  )

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Texto copiado.')
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Scripts comerciais"
        subtitle="Modelos de mensagem por etapa. Use {{empresa}}, {{contato}} e {{meu_nome}} para personalizar."
        actions={<CreateButton onClick={() => setEditing({ script: null })}>Novo script</CreateButton>}
      />
      <FilterBar>
        <SearchInput label="Buscar scripts" placeholder="Buscar nos scripts" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect label="Filtrar por etapa" value={stage} onChange={(e) => setStage(e.target.value as ScriptStage | '')}>
          <option value="">Todas as etapas</option>
          {SCRIPT_STAGES.map((st) => (
            <option key={st.key} value={st.key}>
              {st.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filtrar por canal" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos os canais</option>
          {channels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
      </FilterBar>
      {isPending ? (
        <ScriptGroupsSkeleton />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os scripts." onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ChatText}
          title={filtered ? 'Nenhum script com esses filtros' : 'Nenhum script cadastrado'}
          action={filtered ? undefined : <CreateButton onClick={() => setEditing({ script: null })}>Novo script</CreateButton>}
        >
          {filtered ? 'Ajuste a busca ou escolha outra etapa.' : 'Cadastre as mensagens que a equipe usa na abordagem, no follow-up e no fechamento.'}
        </EmptyState>
      ) : (
        <div ref={listRef}>
          {SCRIPT_STAGES.filter((st) => visible.some((s) => s.stage === st.key)).map((st) => (
            <section key={st.key} className="script-group">
              <SectionTitle>{st.label}</SectionTitle>
              <div className="card-grid">
                {visible
                  .filter((s) => s.stage === st.key)
                  .map((s) => (
                    <Card as="article" key={s.id}>
                      <div className="card-row">
                        <ItemTitle>{s.title}</ItemTitle>
                        <RowActions label={s.title} onEdit={() => setEditing({ script: s })} onDelete={() => setDeleting(s)} />
                      </div>
                      <p className="muted small">{[s.channel, s.niche].filter(Boolean).join(' · ')}</p>
                      {s.usage && <p className="small">{s.usage}</p>}
                      <pre className="script-body">{s.body}</pre>
                      <Button size="sm" onClick={() => void copy(s.body)}>
                        <Copy size={ICON.control} aria-hidden /> Copiar texto
                      </Button>
                    </Card>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.script ? 'Editar script' : 'Novo script'}>
        {editing && <ScriptForm key={editing.script?.id ?? 'novo'} script={editing.script} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title="Excluir script?"
        description={deleting?.title}
        confirmLabel="Excluir"
        danger
        busy={del.isPending}
        error={del.error?.message}
        onConfirm={() => deleting && del.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function ScriptForm({ script, onClose }: { script: ScriptTemplate | null; onClose: () => void }) {
  const { values, bind } = useForm({
    title: script?.title ?? '',
    stage: script?.stage ?? 'AbordagemInicial',
    channel: script?.channel ?? '',
    niche: script?.niche ?? '',
    usage: script?.usage ?? '',
    body: script?.body ?? '',
  })
  const save = useCrmMutation(
    (body: object) => (script ? api.put(`/api/scripts/${script.id}`, { ...body, version: script.version }) : api.post('/api/scripts', body)),
    ['scripts'],
    'Script salvo.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({
      title: values.title.trim(),
      stage: values.stage as ScriptStage,
      channel: blankToNull(values.channel),
      niche: blankToNull(values.niche),
      usage: blankToNull(values.usage),
      body: values.body.trim(),
    })
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="span-2">
          <TextField label="Título" required maxLength={200} autoFocus {...bind('title')} />
        </div>
        <SelectField label="Etapa" {...bind('stage')}>
          {SCRIPT_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Canal" maxLength={100} placeholder="WhatsApp, Direct…" {...bind('channel')} />
        <TextField label="Nicho" maxLength={100} {...bind('niche')} />
        <TextField label="Quando usar" maxLength={500} {...bind('usage')} />
        <div className="span-2">
          <TextAreaField label="Texto" required rows={8} maxLength={8000} hint="Variáveis: {{empresa}}, {{contato}}, {{meu_nome}}" {...bind('body')} />
        </div>
      </div>
      {save.error && <ErrorNote message={save.error.message} />}
      <FormFooter pending={save.isPending} submitLabel="Salvar" onCancel={onClose} disabled={values.title.trim() === '' || values.body.trim() === ''} />
    </form>
  )
}
