import { Link } from 'react-router-dom'
import { Clock, DollarSign, Funnel, Target, type LucideIcon } from 'lucide-react'
import { useDashboard } from '../lib/queries'
import { brl, dateBR, daysUntil } from '../lib/format'
import { CLIENT_STATUSES, STAGES } from '../lib/domain'
import { Badge, ErrorNote, PageHeader } from '../components/ui'
import type { ReactNode } from 'react'

function StatCard({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: ReactNode }) {
  return (
    <section className="stat-card">
      <div className="stat-head">
        <span className="stat-chip" aria-hidden>
          <Icon size={18} />
        </span>
        <h2>{label}</h2>
      </div>
      <p className="stat-value">{value}</p>
      {children}
    </section>
  )
}

export function DashboardPage() {
  const { data, error, isPending, refetch } = useDashboard()

  if (isPending) return <p className="loading">Carregando painel…</p>
  if (error || !data) return <ErrorNote message="Não foi possível carregar o painel." onRetry={() => void refetch()} />

  const progress = Math.min(100, Math.round((data.activeClients / Math.max(data.targetClients, 1)) * 100))
  const remaining = Math.max(data.targetClients - data.activeClients, 0)
  const days = daysUntil(data.deadline)
  const maxStage = Math.max(1, ...STAGES.map((s) => data.leadsByStage[s.key]))

  return (
    <>
      <PageHeader title="Painel" subtitle={`Meta: ${data.targetClients} clientes ativos até ${dateBR(data.deadline)}`} />

      <div className="stat-grid">
        <StatCard icon={Target} label="Clientes ativos" value={`${data.activeClients} / ${data.targetClients}`}>
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="stat-caption">
            {remaining === 0
              ? 'Meta atingida'
              : `Faltam ${remaining} · ${days >= 0 ? `${days} dias até o prazo` : `prazo passou há ${-days} dias`}`}
          </p>
        </StatCard>

        <StatCard icon={DollarSign} label="MRR" value={brl(data.mrr)}>
          <p className="stat-caption">Soma das mensalidades dos clientes ativos</p>
        </StatCard>

        <StatCard icon={Funnel} label="Leads em aberto" value={String(data.openLeads)}>
          <p className="stat-caption">Pipeline estimado: {brl(data.openPipelineValue)}</p>
        </StatCard>

        <StatCard icon={Clock} label="Follow-ups vencidos" value={String(data.followUpsDue)}>
          <p className="stat-caption">
            {data.followUpsDue > 0 ? <Link to="/leads">Ver no funil</Link> : 'Nenhum follow-up atrasado'}
          </p>
        </StatCard>
      </div>

      <div className="panel-grid">
        <section className="panel">
          <h2>Funil de leads</h2>
          <ul className="funnel">
            {STAGES.map((s) => (
              <li key={s.key}>
                <span className="funnel-label">{s.label}</span>
                <span className="funnel-bar" aria-hidden>
                  <span className={`funnel-fill tone-${s.tone}`} style={{ width: `${(data.leadsByStage[s.key] / maxStage) * 100}%` }} />
                </span>
                <strong className="funnel-count">{data.leadsByStage[s.key]}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Carteira por status</h2>
          <ul className="status-list">
            {CLIENT_STATUSES.map((s) => (
              <li key={s.key}>
                <Badge tone={s.tone}>{s.label}</Badge>
                <strong>{data.clientsByStatus[s.key]}</strong>
              </li>
            ))}
          </ul>
          <p className="muted small">Atualizado em {new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </section>
      </div>
    </>
  )
}
