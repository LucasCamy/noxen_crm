import { useState, type FormEvent } from 'react'
import { ChatText, Copy, Plus } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { SCRIPT_STAGES } from '../lib/domain'
import { useCrmMutation } from '../lib/mutations'
import { useScripts } from '../lib/queries'
import type { ScriptStage, ScriptTemplate } from '../lib/types'
import { Button, CardGridSkeleton, Dialog, EmptyState, ErrorNote, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, RowActions, blankToNull, useForm } from '../components/common'
import { useToast } from '../components/Toast'

export function ScriptsPage() {
  const toast = useToast()
  const { data, isPending, isError, refetch } = useScripts()
  const [editing, setEditing] = useState<{ script: ScriptTemplate | null } | null>(null)
  const [deleting, setDeleting] = useState<ScriptTemplate | null>(null)
  const del = useCrmMutation((s: ScriptTemplate) => api.delete(`/api/scripts/${s.id}`), ['scripts'], 'Script excluído.', () => setDeleting(null))

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
        actions={
          <Button type="button" variant="primary" onClick={() => setEditing({ script: null })}>
            <Plus size={18} aria-hidden /> Novo script
          </Button>
        }
      />
      {isPending ? (
        <CardGridSkeleton cards={6} />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os scripts." onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={ChatText}
          title="Nenhum script cadastrado"
          action={
            <Button variant="primary" onClick={() => setEditing({ script: null })}>
              <Plus size={16} aria-hidden /> Novo script
            </Button>
          }
        >
          Cadastre as mensagens que a equipe usa na abordagem, no follow-up e no fechamento.
        </EmptyState>
      ) : (
        SCRIPT_STAGES.filter((st) => data.some((s) => s.stage === st.key)).map((st) => (
          <section key={st.key} className="script-group">
            <h2>{st.label}</h2>
            <div className="script-grid">
              {data
                .filter((s) => s.stage === st.key)
                .map((s) => (
                  <article key={s.id} className="script">
                    <header>
                      <h3>{s.title}</h3>
                      <RowActions label={s.title} onEdit={() => setEditing({ script: s })} onDelete={() => setDeleting(s)} />
                    </header>
                    <p className="muted small">{[s.channel, s.niche].filter(Boolean).join(' · ')}</p>
                    {s.usage && <p className="small">{s.usage}</p>}
                    <pre className="script-body">{s.body}</pre>
                    <Button type="button" size="sm" onClick={() => void copy(s.body)}>
                      <Copy size={16} aria-hidden /> Copiar texto
                    </Button>
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} wide title={editing?.script ? 'Editar script' : 'Novo script'}>
        {editing && <ScriptForm key={editing.script?.id ?? 'novo'} script={editing.script} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog open={!!deleting} title="Excluir script?" description={deleting?.title} confirmLabel="Excluir" danger busy={del.isPending} error={del.error?.message} onConfirm={() => deleting && del.mutate(deleting)} onClose={() => setDeleting(null)} />
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
