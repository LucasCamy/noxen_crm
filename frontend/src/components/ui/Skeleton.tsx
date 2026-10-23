import type { CSSProperties } from 'react'

/** Bloco de carregamento. O brilho é decorativo e some com prefers-reduced-motion (vira cor sólida). */
export function Skeleton({ w = '100%', h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  const style: CSSProperties = { width: w, height: h, borderRadius: r }
  return <span className={`skeleton${className ? ` ${className}` : ''}`} style={style} aria-hidden />
}

/** Faixa de indicadores (Financeiro): mesma estrutura e altura da faixa real. */
export function StatStripSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="stat-strip skeleton-root" role="status" aria-live="polite" aria-label="Carregando indicadores">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="stat" aria-hidden>
          <Skeleton h={12} w={90} />
          <Skeleton h={26} w={120} r={6} />
          <Skeleton h={12} w={150} />
        </div>
      ))}
    </div>
  )
}
