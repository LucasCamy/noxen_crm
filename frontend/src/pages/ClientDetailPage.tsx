import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, WhatsappLogo } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import { CLIENT_STATUSES, clientStatusInfo } from '../lib/domain'
import { brl, dateBR, whatsappUrl } from '../lib/format'
import { useClient, useUsers } from '../lib/queries'
import type { Client, ClientStatus } from '../lib/types'
import { Badge, Button, ButtonLink, Dialog, ErrorNote, PageHeader, Skeleton } from '../components/ui'
import { ClientForm } from '../components/ClientForm'
import { ClientPanels } from '../components/ClientPanels'
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
        <div style={{ margin: '14px 0 24px' }}>
          <Skeleton h={28} w={280} r={6} />
        </div>
        <div className="detail-grid" aria-hidden>
          <div className="panel skeleton-stack">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={36} r={8} />
            ))}
          </div>
          <div className="panel skeleton-stack">
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
          <ArrowLeft size={16} aria-hidden /> Clientes
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
        <ArrowLeft size={16} aria-hidden /> Clientes
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[client.segment, [client.city, client.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || undefined}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      <div className="detail-grid">
        <section className="panel">
          <h2>Dados e contrato</h2>
          <ClientForm key={client.version} client={client} users={users} currentUserId={user?.id ?? ''} canWrite={canWrite} onSaved={() => undefined} />
        </section>

        <aside className="detail-side">
          <section className="panel">
            <h2>Situação</h2>
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
                <dd>{dateBR(client.clientSince)}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{responsible ?? '—'}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{client.leadId ? 'Convertido de um lead' : 'Cadastro direto'}</dd>
              </div>
            </dl>
            {wa && (
              <ButtonLink block href={wa} target="_blank" rel="noreferrer">
                <WhatsappLogo size={16} aria-hidden /> Falar no WhatsApp
              </ButtonLink>
            )}
          </section>
        </aside>
      </div>

      <ClientPanels clientId={client.id} canFinance={canFinance} />

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} title="Encerrar cliente?" description={`${client.name} deixa de contar no MRR e não poderá ser reativado.`}>
        <div className="dialog-form">
          <footer className="dialog-footer">
            <span className="spacer" />
            <Button type="button" onClick={() => setConfirmClose(false)}>
              Cancelar
            </Button>
            <Button
 type="button"
 variant="danger"
 onClick={() => {
 setConfirmClose(false)
 changeStatus.mutate({ target: 'Encerrado', version: client.version })
 }}
>
              Encerrar cliente
            </Button>
          </footer>
        </div>
      </Dialog>
    </>
  )
}
