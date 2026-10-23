import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Buildings, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { CLIENT_STATUSES, clientStatusInfo } from '../lib/domain'
import { CLIENT_COLUMNS } from '../lib/columns'
import { brl } from '../lib/format'
import { useClients, useUsers } from '../lib/queries'
import { useDebounced } from '../lib/useDebounced'
import type { ClientStatus } from '../lib/types'
import { Badge, Button, CreateButton, DateValue, Dialog, EmptyState, ErrorNote, FilterBar, ICON, PageHeader, SearchInput, Segmented, TableHead, TableSkeleton } from '../components/ui'
import { ClientForm } from '../components/ClientForm'

const PAGE_SIZE = 20

export function ClientsPage() {
  const { user, canWrite } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const users = useUsers().data ?? []
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState<ClientStatus | ''>('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const search = useDebounced(searchText.trim())

  // Atalho "Novo cliente" da paleta de comandos.
  const action = (location.state as { action?: string } | null)?.action
  useEffect(() => {
    if (action === 'new' && canWrite) {
      setCreating(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [action, canWrite, navigate, location.pathname])

  const { data, error, isPending, isFetching, refetch } = useClients(status, search, page, PAGE_SIZE)
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const userName = (id: string | null) => users.find((u) => u.id === id)?.fullName ?? '—'
  const filtered = !!(search || status)

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'cliente' : 'clientes'}${filtered ? ' no filtro' : ' na carteira'}` : 'Carteira de clientes'}
        actions={canWrite && <CreateButton onClick={() => setCreating(true)}>Novo cliente</CreateButton>}
      />

      <FilterBar>
        <SearchInput
          label="Buscar clientes"
          placeholder="Buscar por nome ou razão social"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value)
            setPage(1)
          }}
        />
        <Segmented
          label="Filtrar por status"
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={[{ key: '' as const, label: 'Todos' }, ...CLIENT_STATUSES.map((s) => ({ key: s.key, label: s.label }))]}
        />
      </FilterBar>

      {isPending ? (
        <TableSkeleton columns={CLIENT_COLUMNS} rows={7} label="Carregando clientes" />
      ) : error && !data ? (
        <ErrorNote message="Não foi possível carregar os clientes." onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={Buildings}
          title={filtered ? 'Nenhum cliente com esse filtro' : 'Sua carteira ainda está vazia'}
          action={
            filtered ? (
              <Button
                onClick={() => {
                  setSearchText('')
                  setStatus('')
                }}
              >
                Limpar filtros
              </Button>
            ) : canWrite ? (
              <CreateButton onClick={() => setCreating(true)}>Novo cliente</CreateButton>
            ) : undefined
          }
        >
          {filtered ? 'Ajuste a busca ou escolha outro status.' : 'Converta um lead fechado no funil ou cadastre o primeiro cliente direto.'}
        </EmptyState>
      ) : (
        data && (
          <div className={`table-wrap${isFetching ? ' is-refreshing' : ''}`} aria-busy={isFetching}>
            <table className="table">
              <caption className="sr-only">Clientes da carteira</caption>
              <TableHead columns={CLIENT_COLUMNS} />
              <tbody>
                {data.items.map((c) => {
                  const st = clientStatusInfo(c.status)
                  return (
                    <tr key={c.id} className="row-link" onClick={() => navigate(`/clients/${c.id}`)}>
                      <th scope="row">
                        <a
                          href={`/clients/${c.id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            navigate(`/clients/${c.id}`)
                          }}
                        >
                          {c.name}
                        </a>
                        <span className="muted small block">{[c.segment, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
                      </th>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="num">{brl(c.monthlyFee)}</td>
                      <td className="num">dia {c.dueDay}</td>
                      <td className="num">
                        <DateValue value={c.nextMeeting} mode="datetime" />
                      </td>
                      <td>{userName(c.responsibleId)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <nav className="pager" aria-label="Paginação">
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <CaretLeft size={ICON.control} aria-hidden /> Anterior
                </Button>
                <span className="muted small">
                  Página {page} de {pages}
                </span>
                <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Próxima <CaretRight size={ICON.control} aria-hidden />
                </Button>
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
