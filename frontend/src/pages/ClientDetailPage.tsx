import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, WhatsappLogo } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import { CLIENT_STATUSES, clientStatusInfo } from '../lib/domain'
import { EMPTY, brl, whatsappUrl } from '../lib/format'
import { useClient, useUsers } from '../lib/queries'
import type { Client, ClientStatus } from '../lib/types'
import { Badge, ButtonLink, Card, DateValue, ErrorNote, ICON, PageHeader, Skeleton } from '../components/ui'
import { ClientForm } from '../components/ClientForm'
import { ClientPanels } from '../components/ClientPanels'
import { ConfirmDialog } from '../components/common'
import { useToast } from '../components/Toast'

export function ClientDetailPage() {
  const { id } = useParams()
  const { user, canWrite, canFinance } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const users = useUsers().data ?? []
  const { data: client, error, isPending, refetch } = useClient(id)
  const [confirmClose, setConfirmClose] = useState(false)

  const changeStatus = useMutation({
    mutationFn: ({ target, version }: { target: ClientStatus; version: number }) =>
      api.post<Client>(`/api/clients/${id}/status`, { status: target, version }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client', id] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast(`Status alterado para ${clientStatusInfo(updated.status).label}.`)
    },
    onError: async (err) => {
      await queryClient.invalidateQueries({ queryKey: ['client', id] })
      toast(err instanceof ApiError && err.status === 409 ? 'Este cliente foi alterado por outra pessoa. Dados recarregados.' : err.message, 'error')
    },
  })

  if (isPending)
    return (
      <div role="status" aria-live="polite" aria-label="Carregando cliente">
        <Skeleton h={14} w={80} />
        <div className="page-header" aria-hidden>
          <Skeleton h={28} w={280} r={6} />
        </div>
        <div className="detail-grid" aria-hidden>
          <div className="card skeleton-stack">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={36} r={8} />
            ))}
          </div>
          <div className="card skeleton-stack">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={16} w={`${60 + ((i * 9) % 35)}%`} />
            ))}
          </div>
        </div>
      </div>
    )
  if (error || !client) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <>
        <Link to="/clients" className="back-link">
          <ArrowLeft size={ICON.control} aria-hidden /> Clientes
        </Link>
        <ErrorNote message={notFound ? 'Cliente não encontrado.' : 'Não foi possível carregar o cliente.'} onRetry={notFound ? undefined : () => void refetch()} />
      </>
    )
  }

  const st = clientStatusInfo(client.status)
  const wa = whatsappUrl(client.contactWhatsapp)
  const closed = client.status === 'Encerrado'
  const responsible = users.find((u) => u.id === client.responsibleId)?.fullName

  function requestStatus(target: ClientStatus) {
    if (target === client!.status) return
    if (target === 'Encerrado') setConfirmClose(true)
    else changeStatus.mutate({ target, version: client!.version })
  }

  return (
    <>
      <Link to="/clients" className="back-link">
        <ArrowLeft size={ICON.control} aria-hidden /> Clientes
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[client.segment, [client.city, client.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || undefined}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      <div className="detail-grid">
        <Card title="Dados e contrato">
          <ClientForm key={client.version} client={client} users={users} currentUserId={user?.id ?? ''} canWrite={canWrite} onSaved={() => undefined} />
        </Card>

        <aside className="detail-side">
          <Card title="Situação">
            <label className="field">
              <span className="label-text">Status do cliente</span>
              <select value={client.status} disabled={!canWrite || closed || changeStatus.isPending} onChange={(e) => requestStatus(e.target.value as ClientStatus)}>
                {CLIENT_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              {closed && <span className="field-hint">Cliente encerrado não pode ser reativado; cadastre um novo contrato.</span>}
            </label>
            <dl className="facts">
              <div>
                <dt>Mensalidade</dt>
                <dd>{brl(client.monthlyFee)}</dd>
              </div>
              <div>
                <dt>Conta no MRR</dt>
                <dd>{client.status === 'Ativo' ? brl(client.monthlyFee) : 'Não (só clientes ativos)'}</dd>
              </div>
              <div>
                <dt>Implementação</dt>
                <dd>{brl(client.implementationFee)}</dd>
              </div>
              <div>
                <dt>Cliente desde</dt>
                <dd>
                  <DateValue value={client.clientSince} />
                </dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{responsible ?? EMPTY}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{client.leadId ? 'Convertido de um lead' : 'Cadastro direto'}</dd>
              </div>
            </dl>
            {wa && (
              <ButtonLink block href={wa} target="_blank" rel="noreferrer">
                <WhatsappLogo size={ICON.control} aria-hidden /> Falar no WhatsApp
              </ButtonLink>
            )}
          </Card>
        </aside>
      </div>

      <ClientPanels clientId={client.id} canFinance={canFinance} />

      <ConfirmDialog
        open={confirmClose}
        title="Encerrar cliente?"
        description={`${client.name} deixa de contar no MRR e não poderá ser reativado.`}
        confirmLabel="Encerrar cliente"
        danger
        onConfirm={() => {
          setConfirmClose(false)
          changeStatus.mutate({ target: 'Encerrado', version: client.version })
        }}
        onClose={() => setConfirmClose(false)}
      />
    </>
  )
}
