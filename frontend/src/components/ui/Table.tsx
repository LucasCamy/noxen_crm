import type { Column } from '../../lib/columns'
import { Skeleton } from './Skeleton'

/** Cabeçalho de tabela a partir da lista de colunas (a mesma que alimenta o esqueleto). */
export function TableHead({ columns }: { columns: Column[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.label} scope="col" className={c.num ? 'num' : undefined}>
            {c.hidden ? <span className="sr-only">{c.label}</span> : c.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

const widths = (row: number, col: number, base: number) => `${base + ((row * 13 + col * 7) % 30)}%`

function CellSkeleton({ column, row, col }: { column: Column; row: number; col: number }) {
  switch (column.shape) {
    case 'title':
      return (
        <div className="cell-stack">
          <Skeleton h={13} w={widths(row, col, 48)} />
          <Skeleton h={11} w={widths(row, col + 3, 28)} />
        </div>
      )
    case 'badge':
      return <Skeleton h={22} w={72} r={6} />
    case 'num':
      return <Skeleton h={12} w={column.label.length > 9 ? 110 : 76} className="skeleton-end" />
    case 'actions':
      return <Skeleton h={28} w={60} r={8} className="skeleton-end" />
    default:
      return <Skeleton h={12} w={widths(row, col, 40)} />
  }
}

/** Esqueleto de tabela: cabeçalho real, linhas com a forma de cada coluna e a mesma altura das linhas finais. */
export function TableSkeleton({ columns, rows = 6, label = 'Carregando tabela' }: { columns: Column[]; rows?: number; label?: string }) {
  return (
    <div className="table-wrap skeleton-root" role="status" aria-live="polite" aria-label={label}>
      <table className="table">
        <TableHead columns={columns} />
        <tbody aria-hidden>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {columns.map((c, i) => (
                <td key={c.label} className={c.num ? 'num' : undefined}>
                  <CellSkeleton column={c} row={r} col={i} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
