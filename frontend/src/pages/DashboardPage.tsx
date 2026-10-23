import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { useDashboard, usePlanning } from '../lib/queries'
import { addDaysISO, brl, dateBR, daysUntil, formatDate, timeBR, todayISO } from '../lib/format'
import { CLIENT_STATUSES, STAGES, type Tone } from '../lib/domain'
import { Badge, Card, EmptyState, ErrorNote, ICON, PageHeader, SectionTitle, Skeleton } from '../components/ui'
import type { PlanningItem } from '../lib/types'

const KIND_TONE: Record<string, Tone> = { Tarefa: 'brand', 'Follow-up': 'info', Reunião: 'teal', Vencimento: 'warning', Conteúdo: 'neutral' }

function DashboardSkeleton() {
  return (
    <div className="dash" role="status" aria-live="polite" aria-label="Carregando painel">
      <div className="card card-none goal" aria-hidden>
        <div className="goal-main">
          <Skeleton h={14} w={180} />
          <Skeleton h={52} w={140} r={8} />
          <Skeleton h={8} />
          <Skeleton h={12} w={220} />
        </div>
        <div className="goal-side">
          {[0, 1, 2].map((i) => (
            <div key={i} className="stat">
              <Skeleton h={12} w={100} />
              <Skeleton h={22} w={110} r={6} />
              <Skeleton h={12} w={160} />
            </div>
          ))}
        </div>
      </div>
      <div className="dash-cols" aria-hidden>
        <div className="card">
          <div className="skeleton-stack">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} h={12} w={`${40 + ((i * 17) % 55)}%`} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="skeleton-stack">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} h={32} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TodayList({ items }: { items: PlanningItem[] }) {
  if (items.length === 0)
    return (
      <EmptyState icon={CheckCircle} title="Tudo em dia">
        Nenhum follow-up, tarefa ou vencimento para os próximos 7 dias.
      </EmptyState>
    )
  return (
    <ul className="today">
      {items.map((i, idx) => (
        <li key={`${i.kind}-${i.title}-${idx}`}>
          <Badge tone={i.overdue ? 'danger' : (KIND_TONE[i.kind] ?? 'neutral')}>{i.overdue ? 'Atrasado' : i.kind}</Badge>
          <Link to={i.link}>{i.title}</Link>
          <span className="meta">
            {[i.subtitle, i.amount !== null ? brl(i.amount) : null, formatDate(i.date, i.overdue ? 'due' : 'relative')].filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage() {
  const { data, error, isPending, refetch } = useDashboard()
  const today = todayISO()
  const agenda = usePlanning(today, addDaysISO(today, 7))

  if (isPending)
    return (
      <>
        <PageHeader title="Painel" subtitle="Carregando a situação da carteira…" />
        <DashboardSkeleton />
      </>
    )
  if (error || !data) return <ErrorNote message="Não foi possível carregar o painel." onRetry={() => void refetch()} />

  const target = Math.max(data.targetClients, 1)
  const remaining = Math.max(data.targetClients - data.activeClients, 0)
  const days = daysUntil(data.deadline)
  const openStages = STAGES.filter((s) => s.key !== 'Fechado' && s.key !== 'Perdido')
  const maxStage = Math.max(1, ...STAGES.map((s) => data.leadsByStage[s.key]))
  const clientsTotal = CLIENT_STATUSES.reduce((sum, s) => sum + data.clientsByStatus[s.key], 0)
  const todayItems = [...(agenda.data ?? [])].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date)).slice(0, 8)

  return (
    <>
      <PageHeader title="Painel" subtitle={`Meta: ${data.targetClients} clientes ativos até ${dateBR(data.deadline)}`} />

      <div className="dash">
        <Card padding="none" className="goal" aria-labelledby="goal-title">
          <div className="goal-main">
            <SectionTitle id="goal-title">Clientes ativos</SectionTitle>
            <div className="goal-figure">
              <span className="goal-value">{data.activeClients}</span>
              <span className="goal-of">de {data.targetClients}</span>
            </div>
            {data.targetClients <= 24 ? (
              <div className="segments" role="img" aria-label={`${data.activeClients} de ${data.targetClients} clientes ativos`}>
                {Array.from({ length: data.targetClients }, (_, i) => (
                  <i key={i} className={i < data.activeClients ? 'on' : ''} />
                ))}
              </div>
            ) : (
              <div className="bar" role="img" aria-label={`${data.activeClients} de ${data.targetClients} clientes ativos`}>
                <i style={{ ['--v' as string]: Math.min(1, data.activeClients / target) }} />
              </div>
            )}
            <p className="stat-caption">
              {remaining === 0
                ? 'Meta atingida.'
                : `Faltam ${remaining} ${remaining === 1 ? 'cliente' : 'clientes'} · ${days >= 0 ? `${days} ${days === 1 ? 'dia' : 'dias'} até o prazo` : `prazo vencido há ${-days} dias`}`}
            </p>
          </div>

          <div className="goal-side">
            <div className="stat">
              <span className="stat-label">Receita recorrente (MRR)</span>
              <span className="stat-value">{brl(data.mrr)}</span>
              <span className="stat-caption">Mensalidades dos clientes ativos</span>
            </div>
            <div className="stat">
              <span className="stat-label">Leads em aberto</span>
              <span className="stat-value">{data.openLeads}</span>
              <span className="stat-caption">Pipeline estimado de {brl(data.openPipelineValue)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Follow-ups vencidos</span>
              <span className={`stat-value${data.followUpsDue > 0 ? ' tone-text-danger' : ''}`}>{data.followUpsDue}</span>
              <span className="stat-caption">{data.followUpsDue > 0 ? <Link to="/leads">Ver no funil</Link> : 'Nenhum atrasado'}</span>
            </div>
          </div>
        </Card>

        <div className="dash-cols">
          <div className="dash-stack">
            <Card
              title="Funil de leads"
              action={
                <Link to="/leads" className="small">
                  Abrir funil
                </Link>
              }
            >
              <ul className="funnel">
                {STAGES.map((s) => {
                  const idx = openStages.findIndex((o) => o.key === s.key)
                  const t = idx >= 0 ? 55 + (45 * idx) / Math.max(openStages.length - 1, 1) : 100
                  const cls = s.key === 'Fechado' ? 'bar bar-success' : s.key === 'Perdido' ? 'bar bar-danger' : 'bar'
                  return (
                    <li key={s.key} className="funnel-row">
                      <span className="funnel-label">{s.label}</span>
                      <span className={cls} aria-hidden>
                        <i style={{ ['--v' as string]: data.leadsByStage[s.key] / maxStage, ['--t' as string]: `${t}%` }} />
                      </span>
                      <span className="funnel-count">{data.leadsByStage[s.key]}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card
              title="Carteira por status"
              action={
                <Link to="/clients" className="small">
                  Ver clientes
                </Link>
              }
            >
              {clientsTotal === 0 ? (
                <p className="muted">Nenhum cliente ainda. Converta um lead fechado ou cadastre o primeiro.</p>
              ) : (
                <>
                  <div className="split-bar" role="img" aria-label="Distribuição dos clientes por status">
                    {CLIENT_STATUSES.filter((s) => data.clientsByStatus[s.key] > 0).map((s) => (
                      <i key={s.key} className={`tone-${s.tone}`} style={{ flex: data.clientsByStatus[s.key] }} />
                    ))}
                  </div>
                  <ul className="legend">
                    {CLIENT_STATUSES.map((s) => (
                      <li key={s.key}>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        <strong>{data.clientsByStatus[s.key]}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <Card
            title="Para os próximos 7 dias"
            action={
              <Link to="/planning" className="small">
                Agenda completa <ArrowRight className="link-icon" size={ICON.meta} aria-hidden />
              </Link>
            }
          >
            {agenda.isPending ? (
              <div className="skeleton-stack" role="status" aria-live="polite" aria-label="Carregando agenda">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} h={34} />
                ))}
              </div>
            ) : agenda.isError ? (
              <ErrorNote message="Não foi possível carregar a agenda." onRetry={() => void agenda.refetch()} />
            ) : (
              <TodayList items={todayItems} />
            )}
          </Card>
        </div>
      </div>
      <p className="muted small updated-at">Atualizado às {timeBR(data.generatedAt)}</p>
    </>
  )
}
