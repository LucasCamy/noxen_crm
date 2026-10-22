import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { ICON } from './icons'

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
          <WarningCircle size={ICON.meta} aria-hidden />
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
      <MagnifyingGlass size={ICON.control} aria-hidden />
      <input type="search" {...input} />
    </label>
  )
}

/**
 * Barra de filtros: fica logo abaixo do cabeçalho da página, sempre na mesma ordem
 * (busca, selects, segmentado, caixas de seleção). A ação principal da tela vai no cabeçalho, nunca aqui.
 */
export function FilterBar({ label = 'Filtros', children }: { label?: string; children: ReactNode }) {
  return (
    <div className="filter-bar" role="group" aria-label={label}>
      {children}
    </div>
  )
}

/** Select de filtro. `label` é o nome acessível (não aparece). A primeira opção deve ser "Todos…". */
export function FilterSelect({ label, className, children, ...select }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select className={cn('filter-select', className)} aria-label={label} {...select}>
      {children}
    </select>
  )
}

/** Campo de filtro com entrada nativa (mês, data). */
export function FilterInput({ label, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <input className={cn('filter-select', className)} aria-label={label} {...input} />
}

/** Caixa de seleção de filtro ("Só meus leads", "Só abertas"). */
export function FilterCheck({ label, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label className="filter-check">
      <input type="checkbox" {...input} /> {label}
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
