import type { ReactNode } from 'react'
import { Tray, WarningCircle, type Icon } from '@phosphor-icons/react'
import { initials } from '../../lib/format'
import type { Tone } from '../../lib/domain'
import { Button } from './Button'
import { Skeleton } from './Skeleton'

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
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
      <WarningCircle size={18} aria-hidden />
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

/** Estado vazio: explica o que a tela mostra e oferece o próximo passo. */
export function EmptyState({ icon: IconComponent = Tray, title, children, action }: { icon?: Icon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>
        <IconComponent size={22} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

/** Texto de carregamento acessível para regiões que ainda não têm esqueleto próprio. */
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="skeleton-stack" role="status" aria-live="polite" aria-label={label}>
      <Skeleton h={16} w="40%" />
      <Skeleton h={16} w="70%" />
      <Skeleton h={16} w="55%" />
    </div>
  )
}
