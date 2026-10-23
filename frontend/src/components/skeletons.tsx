import { ArrowLeft } from '@phosphor-icons/react'
import { CLIENT_COLUMNS, CONTENT_COLUMNS, USER_COLUMNS, paymentColumns } from '../lib/columns'
import { STAGES, STUDIO_STATUSES, type Tone } from '../lib/domain'
import { Badge, Card, ICON, Skeleton, StatStripSkeleton, TableSkeleton } from './ui'

/**
 * Esqueletos por tela. Cada um repete a estrutura real (mesmas classes, mesmas alturas, rótulos reais onde o
 * texto é fixo) para que a troca por conteúdo não mova nada. A tela usa o mesmo esqueleto quando os dados
 * ainda não chegaram, e o carregamento da rota usa o conjunto completo (cabeçalho, filtros e corpo).
 */

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)
const pct = (i: number, base: number, spread = 30) => `${base + ((i * 17) % spread)}%`

// ---------------------------------------------------------------- cabeçalho, filtros e abas

export function HeaderSkeleton({ title, action }: { title: string; action?: boolean }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p className="header-sub-skeleton">
          <Skeleton h={12} w={240} />
        </p>
      </div>
      {action && (
        <div className="page-actions">
          <Skeleton h={36} w={128} r={8} />
        </div>
      )}
    </header>
  )
}

type FilterControl = 'search' | 'select' | 'segmented' | 'check' | 'month'

export function FilterBarSkeleton({ controls }: { controls: FilterControl[] }) {
  return (
    <div className="filter-bar" aria-hidden>
      {controls.map((c, i) => {
        switch (c) {
          case 'search':
            return (
              <div key={i} className="input-search">
                <Skeleton h={36} r={8} />
              </div>
            )
          case 'segmented':
            return <Skeleton key={i} h={36} w={300} r={8} />
          case 'check':
            return <Skeleton key={i} h={16} w={110} />
          case 'month':
            return <Skeleton key={i} h={36} w={170} r={8} />
          default:
            return <Skeleton key={i} h={36} w={176} r={8} />
        }
      })}
    </div>
  )
}

/** Abas com os rótulos reais (texto fixo), sem interação. */
export function TabsSkeleton({ labels }: { labels: string[] }) {
  return (
    <div className="tabs" aria-hidden>
      {labels.map((l, i) => (
        <span key={l} className={`tab${i === 0 ? ' active' : ''}`}>
          {l}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- quadros (Leads e Estúdio)

interface Lane {
  key: string
  label: string
  tone: Tone
}

function LeadCardSkeleton({ i, studio }: { i: number; studio?: boolean }) {
  return (
    <div className="card card-sm lead-card">
      <Skeleton h={14} w={pct(i, 56)} />
      <Skeleton h={11} w={pct(i + 2, 48)} />
      {!studio && <Skeleton h={12} w="36%" />}
      <div className="lead-foot">
        <Skeleton h={12} w={pct(i + 1, 40)} />
        {!studio && <Skeleton h={22} w={22} r={6} />}
      </div>
    </div>
  )
}

/** Cartões de uma coluna do funil enquanto só ela carrega. */
export function LeadCardsSkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton-cards skeleton-root" role="status" aria-live="polite" aria-label={label}>
      {rows(2).map((i) => (
        <LeadCardSkeleton key={i} i={i} />
      ))}
    </div>
  )
}

function LaneSkeleton({ lane, cards, studio }: { lane: Lane; cards: number; studio?: boolean }) {
  return (
    <div className={`column tone-${lane.tone}`} aria-hidden>
      <div className="column-head">
        {studio ? <Badge tone={lane.tone}>{lane.label}</Badge> : <h3 className="column-name">{lane.label}</h3>}
        <Skeleton h={12} w={14} />
      </div>
      <div className="column-body">
        {rows(cards).map((i) => (
          <LeadCardSkeleton key={i} i={i} studio={studio} />
        ))}
      </div>
    </div>
  )
}

export function LeadsBoardSkeleton() {
  const open = STAGES.filter((s) => s.key !== 'Fechado' && s.key !== 'Perdido')
  const closed = STAGES.filter((s) => s.key === 'Fechado' || s.key === 'Perdido')
  return (
    <div className="skeleton-root" role="status" aria-live="polite" aria-label="Carregando funil de leads">
      <div className="board" style={{ ['--cols' as string]: open.length }}>
        {open.map((s, c) => (
          <LaneSkeleton key={s.key} lane={s} cards={3 - (c % 2)} />
        ))}
      </div>
      <h2 className="group-label board-title" aria-hidden>
        Encerrados
      </h2>
      <div className="board board-closed" style={{ ['--cols' as string]: closed.length }}>
        {closed.map((s) => (
          <LaneSkeleton key={s.key} lane={s} cards={1} />
        ))}
      </div>
    </div>
  )
}

export function StudioBoardSkeleton() {
  return (
    <div className="board studio-board skeleton-root" role="status" aria-live="polite" aria-label="Carregando projetos">
      {STUDIO_STATUSES.map((s, c) => (
        <LaneSkeleton key={s.key} lane={s} cards={c < 2 ? 2 - c : 0} studio />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- listas e grades

/** Linhas da agenda: grupo (rótulo + lista) com emblema, título e detalhe, como em Planejamento e no painel. */
export function AgendaSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <div className="agenda skeleton-root" role="status" aria-live="polite" aria-label="Carregando agenda">
      {rows(groups).map((g) => (
        <section key={g} className="agenda-group" aria-hidden>
          <div className="group-label">
            <Skeleton h={12} w={g === 0 ? 96 : 140} />
          </div>
          <ul>
            {rows(g === 0 ? 3 : 2).map((i) => (
              <li key={i}>
                <Skeleton h={22} w={78} r={6} />
                <Skeleton h={14} w={pct(i + g, 18, 22)} />
                <Skeleton h={12} w={pct(i + g + 1, 14, 18)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Lista de tarefas: caixa de seleção, título com detalhe, prioridade, prazo e ações. */
export function TaskListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="agenda skeleton-root" role="status" aria-live="polite" aria-label="Carregando tarefas">
      <section className="agenda-group" aria-hidden>
        <div className="group-label">
          <Skeleton h={12} w={110} />
        </div>
        <ul className="task-list">
          {rows(items).map((i) => (
            <li key={i} className="task">
              <Skeleton h={16} w={16} r={4} />
              <div className="cell-stack">
                <Skeleton h={13} w={pct(i, 40, 32)} />
                <Skeleton h={11} w={pct(i + 2, 22, 20)} />
              </div>
              <Skeleton h={22} w={64} r={6} />
              <Skeleton h={12} w={84} />
              <Skeleton h={28} w={60} r={8} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Referências do Estúdio e itens com título, detalhe e nota (mesma forma do `.timeline`). */
export function TimelineListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <ul className="timeline skeleton-root" role="status" aria-live="polite" aria-label="Carregando referências">
      {rows(items).map((i) => (
        <li key={i} aria-hidden>
          <div className="timeline-head">
            <Skeleton h={14} w={pct(i, 24, 26)} />
            <Skeleton h={28} w={60} r={8} className="skeleton-end" />
          </div>
          <Skeleton h={12} w={pct(i + 1, 20, 18)} />
        </li>
      ))}
    </ul>
  )
}

function CardActionsSkeleton() {
  return <Skeleton h={28} w={60} r={8} className="skeleton-end" />
}

/** Ideias: emblemas, título, categoria, texto e a faixa de próximo passo. */
export function IdeaCardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="card-grid skeleton-root" role="status" aria-live="polite" aria-label="Carregando ideias">
      {rows(cards).map((i) => (
        <div key={i} className="card" aria-hidden>
          <div className="card-row">
            <Skeleton h={22} w={70} r={6} />
            <Skeleton h={22} w={118} r={6} />
            <CardActionsSkeleton />
          </div>
          <Skeleton h={15} w={pct(i, 52, 30)} />
          <Skeleton h={12} w={pct(i + 1, 24, 18)} />
          <Skeleton h={12} w="92%" />
          <Skeleton h={12} w={pct(i + 2, 52, 30)} />
          <Skeleton h={36} r={8} />
        </div>
      ))}
    </div>
  )
}

/** Scripts: grupos por etapa, cada cartão com título, canal, quando usar, caixa de texto e botão. */
export function ScriptGroupsSkeleton({ groups = 2 }: { groups?: number }) {
  return (
    <div className="skeleton-root" role="status" aria-live="polite" aria-label="Carregando scripts">
      {rows(groups).map((g) => (
        <section key={g} className="script-group" aria-hidden>
          <Skeleton h={20} w={g === 0 ? 150 : 110} r={6} className="skeleton-title" />
          <div className="card-grid">
            {rows(g === 0 ? 3 : 2).map((i) => (
              <div key={i} className="card">
                <div className="card-row">
                  <Skeleton h={15} w={pct(i + g, 40, 30)} />
                  <CardActionsSkeleton />
                </div>
                <Skeleton h={12} w={pct(i, 24, 16)} />
                <Skeleton h={12} w="80%" />
                <Skeleton h={110} r={8} />
                <Skeleton h={30} w={120} r={8} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Base estratégica e kits: cartão com título e ações no cabeçalho e algumas linhas de texto. */
export function DocCardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="card-grid skeleton-root" role="status" aria-live="polite" aria-label="Carregando seções">
      {rows(cards).map((i) => (
        <Card key={i} aria-hidden title={<Skeleton h={16} w={pct(i, 42, 26)} />} action={<CardActionsSkeleton />}>
          <Skeleton h={12} w="96%" />
          <Skeleton h={12} w="88%" />
          <Skeleton h={12} w={pct(i + 1, 50, 30)} />
          <Skeleton h={12} w={pct(i + 3, 28, 20)} />
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- formulários e detalhe

function FieldSkeleton({ w = '100%' }: { w?: number | string }) {
  return (
    <div className="cell-stack">
      <Skeleton h={12} w={w === '100%' ? 90 : w} />
      <Skeleton h={36} r={8} />
    </div>
  )
}

/** Ficha do cliente (aba Visão geral): formulário em duas colunas e cartão de situação. */
export function ClientOverviewSkeleton() {
  return (
    <div className="detail-grid skeleton-root" role="status" aria-live="polite" aria-label="Carregando cliente">
      <Card title="Dados e contrato" aria-hidden>
        <div className="form-grid">
          <div className="span-2">
            <FieldSkeleton />
          </div>
          {rows(8).map((i) => (
            <FieldSkeleton key={i} />
          ))}
          <h3 className="form-section">Contato</h3>
          {rows(2).map((i) => (
            <FieldSkeleton key={i} />
          ))}
          <h3 className="form-section">Contrato</h3>
          {rows(6).map((i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
      </Card>
      <aside className="detail-side" aria-hidden>
        <Card title="Situação">
          <FieldSkeleton />
          <dl className="facts">
            {rows(8).map((i) => (
              <div key={i}>
                <Skeleton h={12} w={pct(i, 28, 16)} />
                <Skeleton h={12} w={pct(i + 2, 22, 14)} />
              </div>
            ))}
          </dl>
        </Card>
      </aside>
    </div>
  )
}

/** Perfil e demais abas em formato de formulário. */
export function FormCardSkeleton({ fields = 8 }: { fields?: number }) {
  return (
    <div className="form-grid skeleton-root" role="status" aria-live="polite" aria-label="Carregando">
      {rows(fields).map((i) => (
        <FieldSkeleton key={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- painel

/** Linhas de "Para os próximos 7 dias": emblema, título e detalhe (mesma forma do `.today`). */
export function TodayListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <ul className="today skeleton-root" role="status" aria-live="polite" aria-label="Carregando agenda">
      {rows(items).map((i) => (
        <li key={i} aria-hidden>
          <Skeleton h={22} w={78} r={6} />
          <Skeleton h={14} w={pct(i, 34, 30)} />
          <span className="meta">
            <Skeleton h={12} w={pct(i + 2, 40, 28)} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="dash skeleton-root" role="status" aria-live="polite" aria-label="Carregando painel">
      <div className="card card-none goal" aria-hidden>
        <div className="goal-main">
          <Skeleton h={16} w={130} />
          <Skeleton h={52} w={150} r={8} />
          <Skeleton h={8} r={4} />
          <Skeleton h={12} w={230} />
        </div>
        <div className="goal-side">
          {rows(3).map((i) => (
            <div key={i} className="stat">
              <Skeleton h={12} w={130} />
              <Skeleton h={22} w={110} r={6} />
              <Skeleton h={12} w={170} />
            </div>
          ))}
        </div>
      </div>
      <div className="dash-cols" aria-hidden>
        <div className="dash-stack">
          <Card title="Funil de leads" action={<Skeleton h={12} w={64} />}>
            <ul className="funnel">
              {rows(7).map((i) => (
                <li key={i} className="funnel-row">
                  <Skeleton h={12} w={pct(i, 52, 30)} />
                  <Skeleton h={8} r={4} />
                  <Skeleton h={12} w={14} className="skeleton-end" />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Carteira por status" action={<Skeleton h={12} w={72} />}>
            <Skeleton h={10} r={4} />
            <ul className="legend">
              {rows(4).map((i) => (
                <li key={i}>
                  <Skeleton h={22} w={92} r={6} />
                  <Skeleton h={12} w={14} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Para os próximos 7 dias" action={<Skeleton h={12} w={96} />}>
          <TodayListSkeleton />
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tela inteira por rota

const CLIENT_TABS = ['Visão geral', 'Perfil', 'Acessos', 'Pagamentos', 'Reuniões', 'Campanhas', 'Resultados', 'Entregas']

/**
 * Esqueleto completo da rota (cabeçalho com o título real, filtros, abas e corpo). Aparece enquanto o código
 * da tela é baixado; a tela, ao montar, continua com o mesmo corpo, então não há salto entre os dois.
 */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return (<><HeaderSkeleton title="Painel" /><DashboardSkeleton /></>)
  if (path === '/leads')
    return (
      <>
        <HeaderSkeleton title="Leads" action />
        <FilterBarSkeleton controls={['search', 'check']} />
        <LeadsBoardSkeleton />
      </>
    )
  if (path === '/clients')
    return (
      <>
        <HeaderSkeleton title="Clientes" action />
        <FilterBarSkeleton controls={['search', 'segmented']} />
        <TableSkeleton columns={CLIENT_COLUMNS} rows={7} label="Carregando clientes" />
      </>
    )
  if (path.startsWith('/clients/'))
    return (
      <>
        <span className="back-link" aria-hidden>
          <ArrowLeft size={ICON.control} /> Clientes
        </span>
        <HeaderSkeleton title="Carregando cliente…" />
        <TabsSkeleton labels={CLIENT_TABS} />
        <ClientOverviewSkeleton />
      </>
    )
  if (path === '/finance')
    return (
      <>
        <HeaderSkeleton title="Financeiro" action />
        <FilterBarSkeleton controls={['month']} />
        <StatStripSkeleton items={5} />
        <TabsSkeleton labels={['Mensalidades e cobranças', 'Lançamentos']} />
        <TableSkeleton columns={paymentColumns(true, true)} rows={4} label="Carregando cobranças" />
      </>
    )
  if (path === '/planning')
    return (
      <>
        <HeaderSkeleton title="Planejamento" action />
        <TabsSkeleton labels={['Agenda', 'Tarefas']} />
        <FilterBarSkeleton controls={['select']} />
        <AgendaSkeleton />
      </>
    )
  if (path === '/contents')
    return (
      <>
        <HeaderSkeleton title="Conteúdos" action />
        <FilterBarSkeleton controls={['search', 'segmented', 'select']} />
        <TableSkeleton columns={CONTENT_COLUMNS} rows={5} label="Carregando conteúdos" />
      </>
    )
  if (path === '/ideas')
    return (
      <>
        <HeaderSkeleton title="Ideias" action />
        <FilterBarSkeleton controls={['search', 'segmented', 'select']} />
        <IdeaCardsSkeleton />
      </>
    )
  if (path === '/scripts')
    return (
      <>
        <HeaderSkeleton title="Scripts comerciais" action />
        <FilterBarSkeleton controls={['search', 'select', 'select']} />
        <ScriptGroupsSkeleton />
      </>
    )
  if (path === '/knowledge')
    return (
      <>
        <HeaderSkeleton title="Base estratégica" action />
        <DocCardsSkeleton />
      </>
    )
  if (path === '/studio')
    return (
      <>
        <HeaderSkeleton title="Estúdio criativo" action />
        <TabsSkeleton labels={['Projetos', 'Kits de marca', 'Referências']} />
        <StudioBoardSkeleton />
      </>
    )
  if (path === '/users')
    return (
      <>
        <HeaderSkeleton title="Usuários" action />
        <TableSkeleton columns={USER_COLUMNS} rows={4} label="Carregando usuários" />
      </>
    )
  return <HeaderSkeleton title="" />
}
