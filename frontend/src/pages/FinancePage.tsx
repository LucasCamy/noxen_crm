import { useState } from 'react'
import { MagicWand, Wallet } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { ledgerColumns, paymentColumns } from '../lib/columns'
import { brl, todayISO } from '../lib/format'
import { useCrmMutation } from '../lib/mutations'
import { useFinanceSummary, useLedger, usePayments } from '../lib/queries'
import { Button, CreateButton, EmptyState, ErrorNote, FilterBar, FilterInput, ICON, PageHeader, StatStripSkeleton, TableSkeleton } from '../components/ui'
import { Tabs } from '../components/common'
import { LedgerFormDialog, LedgerTable, PaymentFormDialog, PaymentsTable } from '../components/FinanceParts'

type Tab = 'payments' | 'ledger'

function Metric({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="stat">
      <h2 className="stat-label">{label}</h2>
      <p className={`stat-value${tone ? ` tone-text-${tone}` : ''}`}>{value}</p>
      <p className="stat-caption">{caption}</p>
    </div>
  )
}

export function FinancePage() {
  const { canFinance, isAdmin } = useAuth()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [tab, setTab] = useState<Tab>('payments')
  const [newPayment, setNewPayment] = useState(false)
  const [newEntry, setNewEntry] = useState(false)

  const summary = useFinanceSummary(month, canFinance)
  const payments = usePayments({ month }, canFinance)
  const ledger = useLedger(month, canFinance)
  const generate = useCrmMutation(
    () => api.post<{ created: number }>(`/api/finance/charges/generate?month=${month}`),
    ['payments', 'finance-summary'],
    (r) => (r.created === 0 ? 'Todos os clientes ativos já têm mensalidade neste mês.' : `${r.created} mensalidades geradas.`),
  )

  if (!canFinance) return <ErrorNote message="Seu perfil não tem acesso ao financeiro." />

  const s = summary.data
  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Caixa do mês: cobranças dos clientes e lançamentos da agência"
        actions={
          <>
            {isAdmin && (
              <Button loading={generate.isPending} onClick={() => generate.mutate(undefined)}>
                <MagicWand size={ICON.control} aria-hidden /> Gerar mensalidades
              </Button>
            )}
            <CreateButton onClick={() => (tab === 'payments' ? setNewPayment(true) : setNewEntry(true))}>{tab === 'payments' ? 'Nova cobrança' : 'Novo lançamento'}</CreateButton>
          </>
        }
      />

      <FilterBar>
        <FilterInput label="Mês" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </FilterBar>

      {summary.isError ? (
        <ErrorNote message="Não foi possível carregar o resumo." onRetry={() => void summary.refetch()} />
      ) : summary.isPending ? (
        <StatStripSkeleton items={5} />
      ) : (
        <div className="stat-strip">
          <Metric label="Recebido no mês" value={brl(s?.received)} caption="Cobranças pagas + receitas avulsas realizadas" tone="success" />
          <Metric label="A receber no mês" value={brl(s?.expected)} caption="Vence neste mês e ainda não foi pago" />
          <Metric label="Em atraso" value={brl(s?.overdue)} caption={s ? `${s.overdueCount} cobrança(s) vencida(s), de qualquer mês` : ''} tone={s && s.overdueCount > 0 ? 'danger' : undefined} />
          <Metric label="Despesas pagas" value={brl(s?.expenses)} caption={s ? `Previstas ainda: ${brl(s.expensesPlanned)}` : ''} />
          <Metric label="Resultado do mês" value={brl(s?.result)} caption="Recebido menos despesas pagas" tone={s && s.result < 0 ? 'danger' : undefined} />
        </div>
      )}

      <Tabs
        label="Seções do financeiro"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'payments', label: 'Mensalidades e cobranças' },
          { key: 'ledger', label: 'Lançamentos' },
        ]}
      />

      {tab === 'payments' ? (
        payments.isPending ? (
          <TableSkeleton columns={paymentColumns(true, true)} rows={4} label="Carregando cobranças" />
        ) : payments.isError ? (
          <ErrorNote message="Não foi possível carregar as cobranças." onRetry={() => void payments.refetch()} />
        ) : payments.data.items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhuma cobrança vence neste mês"
            action={<CreateButton onClick={() => setNewPayment(true)}>Nova cobrança</CreateButton>}
          >
            As mensalidades dos clientes ativos são geradas todo mês. Você também pode criar uma cobrança avulsa.
          </EmptyState>
        ) : (
          <PaymentsTable payments={payments.data.items} showClient canManage />
        )
      ) : ledger.isPending ? (
        <TableSkeleton columns={ledgerColumns(true)} rows={4} label="Carregando lançamentos" />
      ) : ledger.isError ? (
        <ErrorNote message="Não foi possível carregar os lançamentos." onRetry={() => void ledger.refetch()} />
      ) : ledger.data.items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento neste mês"
          action={<CreateButton onClick={() => setNewEntry(true)}>Novo lançamento</CreateButton>}
        >
          Registre receitas avulsas e despesas da agência.
        </EmptyState>
      ) : (
        <LedgerTable entries={ledger.data.items} canManage />
      )}

      <PaymentFormDialog open={newPayment} onClose={() => setNewPayment(false)} />
      <LedgerFormDialog open={newEntry} onClose={() => setNewEntry(false)} />
    </>
  )
}
