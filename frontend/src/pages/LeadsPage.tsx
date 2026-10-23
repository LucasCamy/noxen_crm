import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CalendarDots, Clock } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { STAGES, moveError, stageInfo } from '../lib/domain'
import { brl, dateShort, isOverdue } from '../lib/format'
import { fetchLeads, leadsKey, useUsers } from '../lib/queries'
import { useDebounced } from '../lib/useDebounced'
import type { Lead, LeadStage, UserLookup } from '../lib/types'
import { Avatar, BoardSkeleton, CreateButton, ErrorNote, FilterBar, FilterCheck, ICON, PageHeader, SearchInput, Skeleton } from '../components/ui'
import { useToast } from '../components/Toast'
import { ConvertDialog, LeadDialog, LostDialog } from '../components/LeadDialogs'

const PAGE_SIZE = 50

// Etapas em andamento ocupam o quadro; Fechado e Perdido ficam numa faixa própria abaixo (cabem sem rolagem lateral).
const CLOSED_KEYS: LeadStage[] = ['Fechado', 'Perdido']
const OPEN_STAGES = STAGES.filter((s) => !CLOSED_KEYS.includes(s.key))
const CLOSED_STAGES = STAGES.filter((s) => CLOSED_KEYS.includes(s.key))

function LeadCardView({ lead, owner, overlay }: { lead: Lead; owner?: UserLookup; overlay?: boolean }) {
  const open = lead.stage !== 'Fechado' && lead.stage !== 'Perdido'
  const overdue = open && isOverdue(lead.nextStepDate)
  const place = [lead.segment, [lead.city, lead.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  return (
    <div className={`card card-sm lead-card${overlay ? ' lead-card-overlay' : ''}`}>
      <strong className="lead-company">{lead.company}</strong>
      {place && <span className="lead-meta">{place}</span>}
      {lead.estimatedValue != null && (
        <span className="lead-value">
          {brl(lead.estimatedValue)}
        </span>
      )}
      <div className="lead-foot">
        {lead.nextStepDate || lead.nextStep ? (
          <span className={`lead-next${overdue ? ' overdue' : ''}`}>
            {overdue ? <Clock size={ICON.meta} aria-hidden /> : <CalendarDots size={ICON.meta} aria-hidden />}
            <span>
              {lead.nextStep ?? 'Próximo passo'}
              {lead.nextStepDate ? ` · ${dateShort(lead.nextStepDate)}` : ''}
              {overdue && <span className="sr-only"> (atrasado)</span>}
            </span>
          </span>
        ) : (
          <span className="lead-next muted">Sem próximo passo</span>
        )}
        {owner && <Avatar name={owner.fullName} size="sm" />}
      </div>
    </div>
  )
}

function DraggableLead({ lead, owner, canDrag, onOpen }: { lead: Lead; owner?: UserLookup; canDrag: boolean; onOpen: (lead: Lead) => void }) {
  const draggable = canDrag && lead.stage !== 'Fechado'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { lead }, disabled: !draggable })
  return (
    <div
      ref={setNodeRef}
      className={`lead-slot${isDragging ? ' dragging' : ''}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${lead.company}, ${stageInfo(lead.stage).label}. Enter abre os detalhes${draggable ? '; espaço pega o card para mover' : ''}.`}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(lead)
        else listeners?.onKeyDown?.(e)
      }}
    >
      <LeadCardView lead={lead} owner={owner} />
    </div>
  )
}

interface ColumnProps {
  stage: (typeof STAGES)[number]
  leads: Lead[]
  total: number
  loading: boolean
  failed: boolean
  retry: () => void
  users: UserLookup[]
  canDrag: boolean
  onOpen: (lead: Lead) => void
}

function Column({ stage, leads, total, loading, failed, retry, users, canDrag, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })
  return (
    <section ref={setNodeRef} className={`column tone-${stage.tone}${isOver ? ' over' : ''}`} aria-label={`${stage.label}, ${total} leads`}>
      <header className="column-head">
        <h3 className="column-name">{stage.label}</h3>
        <span className="column-count">{total}</span>
      </header>
      <div className="column-body">
        {failed ? (
          <ErrorNote message="Falha ao carregar." onRetry={retry} />
        ) : loading ? (
          <div className="skeleton-stack" role="status" aria-label={`Carregando ${stage.label}`}>
            <Skeleton h={64} r={8} />
            <Skeleton h={64} r={8} />
          </div>
        ) : leads.length === 0 ? (
          <p className="column-empty">{canDrag ? 'Solte um lead aqui' : 'Nenhum lead'}</p>
        ) : (
          leads.map((lead) => (
            <DraggableLead key={lead.id} lead={lead} owner={users.find((u) => u.id === lead.ownerId)} canDrag={canDrag} onOpen={onOpen} />
          ))
        )}
        {total > leads.length && <p className="muted small">Mostrando {leads.length} de {total}. Refine a busca para ver os demais.</p>}
      </div>
    </section>
  )
}

export function LeadsPage() {
  const { user, canWrite } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const users = useUsers().data ?? []

  const [searchText, setSearchText] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const search = useDebounced(searchText.trim())
  const ownerId = onlyMine ? (user?.id ?? null) : null

  const [dialog, setDialog] = useState<{ lead: Lead | null } | null>(null)
  const [lost, setLost] = useState<Lead | null>(null)
  const [convert, setConvert] = useState<Lead | null>(null)
  const [dragging, setDragging] = useState<Lead | null>(null)

  const results = useQueries({
    queries: STAGES.map((s) => ({
      queryKey: leadsKey(s.key, search, ownerId),
      queryFn: () => fetchLeads(s.key, search, ownerId, PAGE_SIZE),
      placeholderData: keepPreviousData,
    })),
  })
  const totalLeads = results.reduce((sum, r) => sum + (r.data?.total ?? 0), 0)
  const allPending = results.every((r) => r.isPending)

  // Atalhos da paleta de comandos: "Novo lead" e abrir um lead encontrado na busca.
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as { action?: string; leadId?: string } | null
  useEffect(() => {
    if (!routeState) return
    if (routeState.action === 'new' && canWrite) setDialog({ lead: null })
    if (routeState.leadId) {
      api.get<Lead>(`/api/leads/${routeState.leadId}`).then((lead) => setDialog({ lead })).catch(() => toast('Não foi possível abrir o lead.', 'error'))
    }
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState?.action, routeState?.leadId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const move = useMutation({
    mutationFn: ({ lead, target }: { lead: Lead; target: LeadStage }) =>
      api.post<Lead>(`/api/leads/${lead.id}/stage`, { stage: target, lostReason: null, version: lead.version }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast(`${updated.company} movido para ${stageInfo(updated.stage).label}.`)
    },
    onError: async (err) => {
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast(err instanceof Error ? err.message : 'Não foi possível mover o lead.', 'error')
    },
  })

  function requestMove(lead: Lead, target: LeadStage) {
    if (!canWrite || lead.stage === target) return
    const error = moveError(lead.stage, target)
    if (error) return toast(error, 'error')
    if (target === 'Perdido') setLost(lead)
    else if (target === 'Fechado') setConvert(lead)
    else move.mutate({ lead, target })
  }

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current?.lead as Lead | undefined) ?? null)
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const lead = e.active.data.current?.lead as Lead | undefined
    const target = e.over?.id as LeadStage | undefined
    if (lead && target) requestMove(lead, target)
  }

  const accessibility = useMemo(
    () => ({
      screenReaderInstructions: {
        draggable:
          'Para mover o lead, pressione espaço, use as setas para escolher a etapa e pressione espaço para soltar. Esc cancela.',
      },
      announcements: {
        onDragStart: ({ active }: { active: { data: { current?: { lead?: Lead } } } }) =>
          `Pegou ${active.data.current?.lead?.company ?? 'o lead'}.`,
        onDragOver: ({ over }: { over: { id: string | number } | null }) =>
          over ? `Sobre a etapa ${stageInfo(over.id as LeadStage).label}.` : 'Fora de qualquer etapa.',
        onDragEnd: ({ over }: { over: { id: string | number } | null }) =>
          over ? `Solto em ${stageInfo(over.id as LeadStage).label}.` : 'Movimento cancelado.',
        onDragCancel: () => 'Movimento cancelado.',
      },
    }),
    [],
  )

  const renderColumn = (stage: (typeof STAGES)[number]) => {
    const r = results[STAGES.findIndex((s) => s.key === stage.key)]
    return (
      <Column
        key={stage.key}
        stage={stage}
        leads={r.data?.items ?? []}
        total={r.data?.total ?? 0}
        loading={r.isPending}
        failed={r.isError && !r.data}
        retry={() => void r.refetch()}
        users={users}
        canDrag={canWrite}
        onOpen={(lead) => setDialog({ lead })}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${totalLeads} ${totalLeads === 1 ? 'lead' : 'leads'} no funil de prospecção`}
        actions={canWrite && <CreateButton onClick={() => setDialog({ lead: null })}>Novo lead</CreateButton>}
      />

      <FilterBar>
        <SearchInput label="Buscar leads" placeholder="Buscar empresa, contato ou WhatsApp" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        <FilterCheck label="Só meus leads" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
      </FilterBar>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} accessibility={accessibility}>
        {allPending ? (
          <BoardSkeleton columns={OPEN_STAGES.length} />
        ) : (
          <>
            <div className="board" role="group" aria-label="Funil de leads" style={{ ['--cols' as string]: OPEN_STAGES.length }}>
              {OPEN_STAGES.map(renderColumn)}
            </div>
            <h2 className="group-label board-title">Encerrados</h2>
            <div className="board board-closed" role="group" aria-label="Leads encerrados" style={{ ['--cols' as string]: CLOSED_STAGES.length }}>
              {CLOSED_STAGES.map(renderColumn)}
            </div>
          </>
        )}
        <DragOverlay>{dragging && <LeadCardView lead={dragging} owner={users.find((u) => u.id === dragging.ownerId)} overlay />}</DragOverlay>
      </DndContext>

      <LeadDialog
        open={!!dialog}
        lead={dialog?.lead ?? null}
        users={users}
        currentUserId={user?.id ?? ''}
        canWrite={canWrite}
        onClose={() => setDialog(null)}
        onMove={requestMove}
      />
      <LostDialog lead={lost} onClose={() => setLost(null)} />
      <ConvertDialog lead={convert} users={users} onClose={() => setConvert(null)} />
    </>
  )
}
