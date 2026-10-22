import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react'

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
          <WarningCircle size={14} aria-hidden style={{ marginTop: 2, flex: 'none' }} />
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
      <textarea id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} {...area} />
    </FieldShell>
  )
}

/** Busca com ícone. O rótulo é obrigatório por acessibilidade (não aparece, fica para leitores de tela). */
export function SearchInput({ label, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="input-search">
      <span className="sr-only">{label}</span>
      <MagnifyingGlass size={16} aria-hidden />
      <input type="search" {...input} />
    </label>
  )
}

/** Controle segmentado para filtros curtos (uma opção ativa). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { key: T; label: string }[]
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
