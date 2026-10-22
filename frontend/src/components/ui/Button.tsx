import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Plus } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { ICON } from './icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'

interface Shared {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  block?: boolean
}

const classes = ({ variant = 'secondary', size = 'md', block }: Shared) =>
  cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block')

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Shared & { loading?: boolean }

/** Botão padrão. `loading` mostra o indicador, bloqueia cliques repetidos e anuncia o estado (aria-busy). */
export function Button({ variant, size, block, loading, disabled, type = 'button', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(classes({ variant, size, block }), className)}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  )
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & Shared & { children: ReactNode }

/** Link com aparência de botão (ações que abrem outra página ou aplicativo). */
export function ButtonLink({ variant, size, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={cn(classes({ variant, size, block }), className)} {...rest}>
      {children}
    </a>
  )
}

/**
 * Botão de criar ("Novo lead", "Nova tarefa"): sempre primário, com o mesmo ícone e tamanho.
 * Aparece no cabeçalho da página; nos estados vazios, repete a mesma ação com o mesmo componente.
 */
export function CreateButton({ children, ...rest }: Omit<ButtonProps, 'variant' | 'size' | 'block'>) {
  return (
    <Button variant="primary" {...rest}>
      <Plus size={ICON.control} aria-hidden /> {children}
    </Button>
  )
}

/** Botão só com ícone: o nome acessível (`label`) é obrigatório. */
export function IconButton({ label, children, className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type={type} className={cn('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
