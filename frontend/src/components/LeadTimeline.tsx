import { useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { stageInfo } from '../lib/domain'
import { formatDate } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useLeadTimeline } from '../lib/queries'
import type { Lead, LeadTimelineItem } from '../lib/types'
import { Button, ICON, IconButton, Loading, SectionTitle } from './ui'
import { ConfirmDialog } from './common'

const MAX_NOTE = 2000

/** Histórico do lead: mudanças de etapa e anotações livres, da mais recente para a mais antiga. */
export function LeadTimeline({ lead, userName }: { lead: Lead; userName: (id: string | null) => string }) {
  const { user, canWrite, isAdmin } = useAuth()
  const timeline = useLeadTimeline(lead.id)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState<LeadTimelineItem | null>(null)

  const add = useCrmMutation((body: { text: string }) => api.post(`/api/leads/${lead.id}/notes`, body), ['lead-timeline'], 'Anotação registrada.', () => setText(''))
  const remove = useCrmMutation((noteId: string) => api.delete(`/api/lead-notes/${noteId}`), ['lead-timeline'], 'Anotação apagada.', () => setDeleting(null))

  const trimmed = text.trim()
  const items = [...(timeline.data ?? [])].reverse()
  const mine = (item: LeadTimelineItem) => isAdmin || (item.byId !== null && item.byId === user?.id)

  return (
    <section className="history" aria-label="Histórico do lead">
      <SectionTitle as="h3">Histórico</SectionTitle>

      {canWrite && (
        <div className="note-composer">
          <label className="sr-only" htmlFor={`note-${lead.id}`}>
            Nova anotação
          </label>
          <textarea
            id={`note-${lead.id}`}
            rows={2}
            maxLength={MAX_NOTE}
            value={text}
            placeholder="Anotação: o que foi dito, combinado ou percebido (ex.: respondeu pedindo para falar na segunda)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && trimmed) add.mutate({ text: trimmed })
            }}
          />
          <div className="note-composer-actions">
            <span className="muted small">Ctrl + Enter para salvar</span>
            <Button size="sm" variant="primary" loading={add.isPending} disabled={!trimmed} onClick={() => add.mutate({ text: trimmed })}>
              Adicionar anotação
            </Button>
          </div>
          {add.error && <p className="field-msg">{add.error.message}</p>}
        </div>
      )}

      {timeline.isPending ? (
        <Loading label="Carregando histórico" />
      ) : items.length === 0 ? (
        <p className="muted small">Ainda sem movimentações. Criado em {formatDate(lead.createdAt, 'datetime')}.</p>
      ) : (
        <ol>
          {items.map((item) =>
            item.kind === 'note' ? (
              <li key={item.noteId} className="timeline-note">
                <p className="pre">{item.text}</p>
                <span className="muted small timeline-meta">
                  Anotação · {formatDate(item.at, 'datetime')} · {userName(item.byId)}
                  {canWrite && mine(item) && (
                    <IconButton label="Apagar anotação" onClick={() => setDeleting(item)}>
                      <Trash size={ICON.control} aria-hidden />
                    </IconButton>
                  )}
                </span>
              </li>
            ) : (
              <li key={`${item.at}-${item.to}`}>
                <span>
                  {item.from && stageInfo(item.from).label} → <strong>{item.to && stageInfo(item.to).label}</strong>
                </span>
                <span className="muted small">
                  {formatDate(item.at, 'datetime')} · {userName(item.byId)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Apagar anotação?"
        description={deleting?.text ?? undefined}
        confirmLabel="Apagar"
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting?.noteId && remove.mutate(deleting.noteId)}
        onClose={() => setDeleting(null)}
      />
    </section>
  )
}
