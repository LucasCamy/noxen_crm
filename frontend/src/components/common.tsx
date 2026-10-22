import { useId, useState } from 'react'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Button, Dialog, ErrorNote, IconButton } from './ui'

/** Abas simples e acessíveis (role=tablist). O conteúdo ativo é renderizado pelo chamador. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
  label: string
}) {
  const base = useId()
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`${base}-${t.key}`}
          aria-selected={value === t.key}
          className={`tab${value === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  error?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, danger, busy, error, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="dialog-form">
        {error && <ErrorNote message={error} />}
        <footer className="dialog-footer">
          <span className="spacer" />
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </Dialog>
  )
}

/** Estado de formulário baseado em strings, com `bind('campo')` para espalhar em TextField/SelectField. */
export function useForm<T extends Record<string, string>>(initial: T | (() => T)) {
  const [values, setValues] = useState<T>(initial)
  const bind = <K extends keyof T>(key: K) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  })
  return { values, setValues, bind }
}

export const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim())

export function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete?: () => void; label: string }) {
  return (
    <span className="row-actions">
      <IconButton label={`Editar ${label}`} onClick={onEdit}>
        <PencilSimple size={16} />
      </IconButton>
      {onDelete && (
        <IconButton label={`Excluir ${label}`} onClick={onDelete}>
          <Trash size={16} />
        </IconButton>
      )}
    </span>
  )
}

export function FormFooter({ pending, submitLabel, onCancel, disabled }: { pending: boolean; submitLabel: string; onCancel: () => void; disabled?: boolean }) {
  return (
    <footer className="dialog-footer">
      <span className="spacer" />
      <Button onClick={onCancel}>Cancelar</Button>
      <Button type="submit" variant="primary" loading={pending} disabled={disabled}>
        {submitLabel}
      </Button>
    </footer>
  )
}
