/**
 * Colunas das tabelas do produto. O cabeçalho real e o esqueleto de carregamento nascem da mesma lista,
 * então o que aparece enquanto os dados chegam tem exatamente as colunas, o alinhamento e a altura de linha finais.
 */
export type CellShape = 'title' | 'text' | 'badge' | 'num' | 'actions'

export interface Column {
  label: string
  shape: CellShape
  /** Alinha à direita (valores, datas). */
  num?: boolean
  /** Rótulo só para leitores de tela (coluna de ações). */
  hidden?: boolean
}

export const CLIENT_COLUMNS: Column[] = [
  { label: 'Cliente', shape: 'title' },
  { label: 'Status', shape: 'badge' },
  { label: 'Mensalidade', shape: 'num', num: true },
  { label: 'Vencimento', shape: 'num', num: true },
  { label: 'Próxima reunião', shape: 'num', num: true },
  { label: 'Responsável', shape: 'text' },
]

export const CONTENT_COLUMNS: Column[] = [
  { label: 'Conteúdo', shape: 'title' },
  { label: 'Cliente', shape: 'text' },
  { label: 'Canal', shape: 'text' },
  { label: 'Publicação', shape: 'num', num: true },
  { label: 'Status', shape: 'badge' },
  { label: 'Ações', shape: 'actions', hidden: true },
]

export const USER_COLUMNS: Column[] = [
  { label: 'Nome', shape: 'text' },
  { label: 'E-mail', shape: 'text' },
  { label: 'Papel', shape: 'text' },
  { label: 'Situação', shape: 'badge' },
  { label: 'Ações', shape: 'actions', hidden: true },
]

export const paymentColumns = (showClient: boolean, canManage: boolean): Column[] => [
  ...(showClient ? [{ label: 'Cliente', shape: 'text' } as Column] : []),
  { label: 'Cobrança', shape: 'title' },
  { label: 'Vencimento', shape: 'num', num: true },
  { label: 'Valor', shape: 'num', num: true },
  { label: 'Status', shape: 'badge' },
  ...(canManage ? [{ label: 'Ações', shape: 'actions', hidden: true } as Column] : []),
]

export const ledgerColumns = (canManage: boolean): Column[] => [
  { label: 'Data', shape: 'num', num: true },
  { label: 'Descrição', shape: 'title' },
  { label: 'Tipo', shape: 'text' },
  { label: 'Valor', shape: 'num', num: true },
  { label: 'Status', shape: 'badge' },
  ...(canManage ? [{ label: 'Ações', shape: 'actions', hidden: true } as Column] : []),
]

export const ACCESS_COLUMNS: Column[] = [
  { label: 'Plataforma', shape: 'title' },
  { label: 'Conta ou login', shape: 'text' },
  { label: 'Tipo de acesso', shape: 'text' },
  { label: 'Onde está a senha', shape: 'text' },
  { label: 'Concedido em', shape: 'num', num: true },
  { label: 'Ações', shape: 'actions', hidden: true },
]

export const CAMPAIGN_COLUMNS: Column[] = [
  { label: 'Campanha', shape: 'title' },
  { label: 'Status', shape: 'badge' },
  { label: 'Período', shape: 'text' },
  { label: 'Verba', shape: 'num', num: true },
  { label: 'Ações', shape: 'actions', hidden: true },
]

export const RESULT_COLUMNS: Column[] = [
  { label: 'Mês', shape: 'text' },
  { label: 'Verba', shape: 'num', num: true },
  { label: 'Leads', shape: 'num', num: true },
  { label: 'Vendas', shape: 'num', num: true },
  { label: 'Faturamento', shape: 'num', num: true },
  { label: 'CPL', shape: 'num', num: true },
  { label: 'Custo/venda', shape: 'num', num: true },
  { label: 'ROAS', shape: 'num', num: true },
  { label: 'Ações', shape: 'actions', hidden: true },
]
