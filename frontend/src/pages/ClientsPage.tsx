import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { CLIENT_STATUSES, clientStatusInfo } from '../lib/domain'
import { brl, dateTimeBR } from '../lib/format'
import { useClients, useUsers } from '../lib/queries'
import { useDebounced } from '../lib/useDebounced'
import type { ClientStatus } from '../lib/types'
import { Badge, Dialog, EmptyState, ErrorNote, PageHeader } from '../components/ui'
import { ClientForm } from '../components/ClientForm'

const PAGE_SIZE = 20

export function ClientsPage() {
  const { user, canWrite } = useAuth()
  const navigate = useNavigate()
  const users = useUsers().data ?? []
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<ClientStatus | ''>('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const search = useDebounced(searchText.trim())

  const { data, error, isPending, isFetching, refetch } = useClients(status, search, page, PAGE_SIZE)
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const userName = (id: string | null) => users.find((u) => u.id === id)?.fullName ?? '—'

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'cliente' : 'clientes'} na carteira` : 'Carteira de clientes'}
        actions={
          <>
            <label className="search">
              <Search size={18} aria-hidden />
              <input
                type="search"
                placeholder="Buscar por nome ou razão social"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value)
                  setPage(1)
                }}
                aria-label="Buscar clientes"
              />
            </label>
            <select
              className="select-inline"
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ClientStatus | '')
                setPage(1)
              }}
            >
              <option value="">Todos os status</option>
              {CLIENT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            {canWrite && (
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={18} aria-hidden /> Novo cliente
              </button>
            )}
          </>
        }
      />

      {isPending ? (
        <p className="loading">Carregando clientes…</p>
      ) : error && !data ? (
        <ErrorNote message="Não foi possível carregar os clientes." onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Nenhum cliente encontrado">
          {search || status ? 'Ajuste a busca ou o filtro.' : 'Converta um lead fechado ou cadastre o primeiro cliente.'}
        </EmptyState>
      ) : (
        data && (
          <div className={`table-wrap${isFetching ? ' fetching' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Mensalidade
                  </th>
                  <th scope="col" className="num">
                    Vencimento
                  </th>
                  <th scope="col">Próxima reunião</th>
                  <th scope="col">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const st = clientStatusInfo(c.status)
                  return (
                    <tr key={c.id} className="row-link">
                      <th scope="row">
                        <a
                          href={`/clients/${c.id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/clients/${c.id}`)
                          }}
                        >
                          {c.name}
                        </a>
                        <span className="muted small">{[c.segment, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
                      </th>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="num">{brl(c.monthlyFee)}</td>
                      <td className="num">dia {c.dueDay}</td>
                      <td>{dateTimeBR(c.nextMeeting)}</td>
                      <td>{userName(c.responsibleId)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <nav className="pager" aria-label="Paginação">
                <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={16} aria-hidden /> Anterior
                </button>
                <span className="muted small">
                  Página {page} de {pages}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Próxima <ChevronRight size={16} aria-hidden />
                </button>
              </nav>
            )}
          </div>
        )
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} wide title="Novo cliente" description="Cadastro direto, sem passar pelo funil de leads.">
        <ClientForm
          users={users}
          currentUserId={user?.id ?? ''}
          canWrite={canWrite}
          onCancel={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false)
            navigate(`/clients/${c.id}`)
          }}
        />
      </Dialog>
    </>
  )
}
