import {
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { X } from 'lucide-react'
import { initials } from '../lib/format'
import type { Tone } from '../lib/domain'

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <i aria-hidden />
      {children}
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} title={name} aria-label={name} role="img">
      {initials(name)}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

interface FieldShellProps {
  label: string
  error?: string
  hint?: string
  htmlFor: string
  children: ReactNode
}

function FieldShell({ label, error, hint, htmlFor, children }: FieldShellProps) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className="field-msg" id={`${htmlFor}-msg`}>
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={`${htmlFor}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }

export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <input id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} {...input} />
    </FieldShell>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }

export function SelectField({ label, error, children, ...select }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell label={label} error={error} htmlFor={id}>
      <select id={id} aria-invalid={!!error} {...select}>
        {children}
      </select>
    </FieldShell>
  )
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }

export function TextAreaField({ label, error, hint, ...area }: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <textarea id={id} aria-invalid={!!error} {...area} />
    </FieldShell>
  )
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  wide?: boolean
  children: ReactNode
}

/** Diálogo modal nativo (<dialog>): foco preso, Esc fecha e o fundo fica inerte. O conteúdo só monta quando aberto. */
export function Dialog({ open, onClose, title, description, wide, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="dialog-inner">
          <header className="dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
