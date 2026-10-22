import { useId, type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Título de seção (h2 por padrão; h3 dentro de diálogos e cartões). Um único tamanho em todo o produto. */
export function SectionTitle({ as: Tag = 'h2', id, children }: { as?: 'h2' | 'h3'; id?: string; children: ReactNode }) {
  return (
    <Tag id={id} className="section-title">
      {children}
    </Tag>
  )
}

/** Título de um item dentro de um cartão (ideia, script, projeto). Sempre h3, abaixo do título da seção. */
export function ItemTitle({ children }: { children: ReactNode }) {
  return <h3 className="item-title">{children}</h3>
}

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: ElementType
  /** Título da seção; quando existe, o cartão fica rotulado por ele. */
  title?: ReactNode
  /** Ação à direita do título (link "Ver tudo", botões de linha). */
  action?: ReactNode
  /** md (padrão), sm (cartões densos como os do Kanban) ou none (o conteúdo cuida do próprio espaço). */
  padding?: 'md' | 'sm' | 'none'
}

/**
 * Cartão único do produto: borda, raio e espaçamento vêm só daqui.
 * Use `title`/`action` para o cabeçalho; o corpo é o que vem em `children`.
 */
export function Card({ as: Tag = 'section', title, action, padding = 'md', className, children, ...rest }: CardProps) {
  const titleId = useId()
  return (
    <Tag className={cn('card', padding !== 'md' && `card-${padding}`, className)} aria-labelledby={title ? titleId : undefined} {...rest}>
      {(title || action) && (
        <div className="card-head">
          {title ? <SectionTitle id={titleId}>{title}</SectionTitle> : <span />}
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}
