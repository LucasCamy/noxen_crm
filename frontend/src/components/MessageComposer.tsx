import { useMemo, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { SCRIPT_STAGES } from '../lib/domain'
import { firstName, renderScript, whatsappUrlWithText } from '../lib/format'
import { useScripts } from '../lib/queries'
import type { Lead } from '../lib/types'
import { useToast } from './Toast'

/** Monta a mensagem de abordagem do lead a partir de um script, com os placeholders preenchidos e editável antes de enviar. */
export function MessageComposer({ lead }: { lead: Lead }) {
  const { user } = useAuth()
  const toast = useToast()
  const scripts = useScripts()
  const [scriptId, setScriptId] = useState('')
  const [edited, setEdited] = useState<string | null>(null)

  const script = scripts.data?.find((s) => s.id === scriptId)
  const rendered = useMemo(
    () =>
      script
        ? renderScript(script.body, { empresa: lead.company, contato: lead.contactName ? firstName(lead.contactName) : null, meu_nome: user ? firstName(user.fullName) : null })
        : '',
    [script, lead.company, lead.contactName, user],
  )
  const text = edited ?? rendered
  const wa = whatsappUrlWithText(lead.whatsapp, text)

  if (scripts.isPending || !scripts.data || scripts.data.length === 0) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast('Mensagem copiada.')
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'error')
    }
  }

  return (
    <section className="composer" aria-label="Mensagem de abordagem">
      <h3>Mensagem de abordagem</h3>
      <label className="field">
        <span className="label-text">Modelo</span>
        <select
          value={scriptId}
          onChange={(e) => {
            setScriptId(e.target.value)
            setEdited(null)
          }}
        >
          <option value="">Escolher um script…</option>
          {SCRIPT_STAGES.filter((st) => scripts.data.some((s) => s.stage === st.key)).map((st) => (
            <optgroup key={st.key} label={st.label}>
              {scripts.data
                .filter((s) => s.stage === st.key)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {script && (
        <>
          <label className="field">
            <span className="label-text">Texto (você pode ajustar antes de enviar)</span>
            <textarea rows={6} value={text} onChange={(e) => setEdited(e.target.value)} />
          </label>
          <div className="composer-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
              <Copy size={16} aria-hidden /> Copiar
            </button>
            {wa ? (
              <a className="btn btn-primary btn-sm" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={16} aria-hidden /> Abrir no WhatsApp
              </a>
            ) : (
              <span className="muted small">Cadastre o WhatsApp do lead para abrir a conversa.</span>
            )}
          </div>
          <p className="muted small">O envio é sempre feito por você, no WhatsApp.</p>
        </>
      )}
    </section>
  )
}
