import type { CSSProperties } from 'react'

/** Bloco de carregamento. O brilho é decorativo e some com prefers-reduced-motion (vira cor sólida). */
export function Skeleton({ w = '100%', h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  const style: CSSProperties = { width: w, height: h, borderRadius: r }
  return <span className={`skeleton${className ? ` ${className}` : ''}`} style={style} aria-hidden />
}

export function TableSkeleton({ rows = 6, cols = 5, label = 'Carregando tabela' }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div className="table-wrap" role="status" aria-live="polite" aria-label={label}>
      <table className="table" aria-hidden>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c}>
                <Skeleton h={10} w={c === 0 ? 70 : 54} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                  <Skeleton h={12} w={c === 0 ? `${52 + ((r * 13) % 28)}%` : `${40 + ((r * 7 + c * 11) % 35)}%`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatStripSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="stat-strip" role="status" aria-live="polite" aria-label="Carregando indicadores">
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

export function ListSkeleton({ rows = 5, label = 'Carregando lista' }: { rows?: number; label?: string }) {
  return (
    <div className="task-list" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="task task-skeleton" aria-hidden>
          <div className="skeleton-stack">
            <Skeleton h={13} w={`${46 + ((i * 17) % 36)}%`} />
            <Skeleton h={11} w={`${24 + ((i * 11) % 24)}%`} />
          </div>
          <Skeleton h={22} w={64} />
        </div>
      ))}
    </div>
  )
}

export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="board" role="status" aria-live="polite" aria-label="Carregando funil">
      {Array.from({ length: columns }, (_, c) => (
        <div key={c} className="column" aria-hidden>
          <div className="column-head">
            <Skeleton h={12} w={90} />
            <Skeleton h={12} w={16} />
          </div>
          <div className="column-body">
            {Array.from({ length: 3 - (c % 2) }, (_, i) => (
              <div key={i} className="card card-sm lead-card">
                <Skeleton h={14} w="70%" />
                <Skeleton h={11} w="50%" />
                <Skeleton h={11} w="40%" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="idea-grid" role="status" aria-live="polite" aria-label="Carregando">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="card" aria-hidden>
          <Skeleton h={14} w="60%" />
          <Skeleton h={11} w="35%" />
          <Skeleton h={11} w="90%" />
          <Skeleton h={11} w="75%" />
        </div>
      ))}
    </div>
  )
}
