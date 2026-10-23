import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, Globe, InstagramLogo, WhatsappLogo } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../lib/api'
import { CLIENT_STATUSES, clientStatusInfo } from '../lib/domain'
import { EMPTY, brl, safeUrl, whatsappUrl } from '../lib/format'
import { useClient, useClientProfile, useUsers } from '../lib/queries'
import type { Client, ClientStatus } from '../lib/types'
import { Badge, Button, ButtonLink, Card, DateValue, ErrorNote, ICON, ListSkeleton, PageHeader, Skeleton } from '../components/ui'
import { ClientForm } from '../components/ClientForm'
import { CampaignsPanel, MeetingsPanel, PaymentsPanel, ResultsPanel } from '../components/ClientPanels'
import { AccessesPanel, DeliveriesPanel, ProfilePanel } from '../components/ClientProfilePanels'
import { ConfirmDialog, Tabs } from '../components/common'
import { useToast } from '../components/Toast'

type DetailTab = 'overview' | 'profile' | 'accesses' | 'payments' | 'meetings' | 'campaigns' | 'results' | 'deliveries'

export function ClientDetailPage() {
  const { id } = useParams()
  const { user, canWrite, canFinance } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const users = useUsers().data ?? []
  const { data: client, error, isPending, refetch } = useClient(id)
  const [confirmClose, setConfirmClose] = useState(false)
  const [tab, setTab] = useState<DetailTab>('overview')
  const profile = useClientProfile(id)

  const changeStatus = useMutation({
    mutationFn: ({ target, version }: { target: ClientStatus; version: number }) => api.post<Client>(`/api/clients/${id}/status`, { status: target, version }),
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
  const instagram = profile.data?.instagram ? `https://instagram.com/${profile.data.instagram}` : null
  const website = safeUrl(profile.data?.website)
  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'profile', label: 'Perfil' },
    { key: 'accesses', label: 'Acessos' },
    ...(canFinance ? [{ key: 'payments' as const, label: 'Pagamentos' }] : []),
    { key: 'meetings', label: 'Reuniões' },
    { key: 'campaigns', label: 'Campanhas' },
    { key: 'results', label: 'Resultados' },
    { key: 'deliveries', label: 'Entregas' },
  ]

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(client!.contactEmail ?? '')
      toast('E-mail copiado.')
    } catch {
      toast('Não foi possível copiar o e-mail.', 'error')
    }
  }

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
        actions={
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            {wa && (
              <ButtonLink href={wa} target="_blank" rel="noreferrer">
                <WhatsappLogo size={ICON.control} aria-hidden /> WhatsApp
              </ButtonLink>
            )}
            {instagram && (
              <ButtonLink href={instagram} target="_blank" rel="noopener noreferrer">
                <InstagramLogo size={ICON.control} aria-hidden /> @{profile.data?.instagram}
              </ButtonLink>
            )}
            {website && (
              <ButtonLink href={website} target="_blank" rel="noopener noreferrer">
                <Globe size={ICON.control} aria-hidden /> Site
              </ButtonLink>
            )}
            {client.contactEmail && (
              <Button onClick={() => void copyEmail()}>
                <Copy size={ICON.control} aria-hidden /> Copiar e-mail
              </Button>
            )}
          </>
        }
      />

      <Tabs label="Seções do cliente" tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
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
                  <dt>Forma de pagamento</dt>
                  <dd>{client.paymentMethod ?? EMPTY}</dd>
                </div>
                <div>
                  <dt>Fim do contrato</dt>
                  <dd>
                    <DateValue value={client.contractEnd} />
                  </dd>
                </div>
                <div>
                  <dt>Verba de anúncios</dt>
                  <dd>{profile.data?.adBudget == null ? EMPTY : brl(profile.data.adBudget)}</dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>{client.leadId ? 'Convertido de um lead' : 'Cadastro direto'}</dd>
                </div>
              </dl>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'profile' && (
        <Card aria-label="Perfil do cliente">
          {profile.data ? (
            <ProfilePanel key={profile.data.version} profile={profile.data} />
          ) : profile.isError ? (
            <ErrorNote message="Não foi possível carregar o perfil." onRetry={() => void profile.refetch()} />
          ) : (
            <ListSkeleton rows={6} label="Carregando perfil" />
          )}
        </Card>
      )}
      {tab === 'accesses' && (
        <Card aria-label="Acessos do cliente">
          <AccessesPanel clientId={client.id} />
        </Card>
      )}
      {tab === 'payments' && canFinance && (
        <Card aria-label="Pagamentos do cliente">
          <PaymentsPanel clientId={client.id} />
        </Card>
      )}
      {tab === 'meetings' && (
        <Card aria-label="Reuniões do cliente">
          <MeetingsPanel clientId={client.id} />
        </Card>
      )}
      {tab === 'campaigns' && (
        <Card aria-label="Campanhas do cliente">
          <CampaignsPanel clientId={client.id} />
        </Card>
      )}
      {tab === 'results' && (
        <Card aria-label="Resultados do cliente">
          <ResultsPanel clientId={client.id} />
        </Card>
      )}
      {tab === 'deliveries' && (
        <Card aria-label="Entregas do cliente">
          <DeliveriesPanel clientId={client.id} />
        </Card>
      )}

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
