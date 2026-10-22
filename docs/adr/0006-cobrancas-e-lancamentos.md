# ADR-0006: Cobranças e lançamentos separados; atraso derivado; mensalidade gerada pelo Worker

- Status: Proposta (implementada)
- Data do registro: 2026-10-22
- Referências: `clientes/*/financeiro.md` e `crm/financeiro-noxen.md` do CRM original

## Contexto

No original o financeiro eram tabelas Markdown: histórico de pagamentos por cliente (mês, valor, vencimento, pago em, status) e receitas avulsas/despesas da agência, com status "Atrasado" digitado à mão. É preciso saber o que foi recebido, o que vence e o que está atrasado, sem depender de alguém atualizar o status.

## Decisão

- Duas entidades: `Payment` (cobrança de um cliente: mensalidade, implementação ou avulsa) e `LedgerEntry` (receita avulsa ou despesa da agência, opcionalmente ligada a um cliente).
- O status gravado é só `Pendente | Pago | Cancelado` (cobranças) e `Previsto | Realizado | Cancelado` (lançamentos). **"Atrasado" é derivado**: pendente/previsto com vencimento anterior a hoje, calculado na leitura.
- Valores monetários em `decimal(14,2)`; datas de vencimento e de pagamento em `DateOnly`; pagamento nunca em data futura; cobrança paga não é cancelada e cancelada não é paga (correções passam por cancelar e recriar, preservando o histórico).
- Uma mensalidade ativa por cliente e mês, garantida por **índice único parcial** (`Kind = 'Mensalidade' AND Status <> 'Cancelado'`).
- O Worker (`MaintenanceService`, a cada hora) gera a mensalidade do mês corrente para cada cliente ativo com valor > 0 e apaga da outbox as mensagens publicadas há mais de 7 dias. Ambas as rotinas são idempotentes e seguras com várias instâncias; a geração também pode ser disparada por um Admin (`POST /api/finance/charges/generate`).
- O resumo do mês considera "recebido" pela data de pagamento/realização e "previsto" pelo vencimento; em atraso conta cobranças de qualquer mês.
- Acesso: Admin e Comercial (leitura e escrita); Marketing não vê o financeiro.

## Alternativas consideradas

- Gravar "Atrasado" como status: descartada por exigir um job para trocar status e por divergir conforme a hora da consulta.
- Uma única tabela para cobranças e lançamentos: descartada porque cobranças têm cliente obrigatório, referência mensal e a regra de unicidade; lançamentos não.
- Gerar a cobrança no momento da conversão do lead: descartada por ora; implementação e valores extras são cadastrados manualmente.

## Consequências

- O fuso é UTC ao decidir "hoje" (um vencimento pode aparecer atrasado algumas horas antes do esperado no Brasil, UTC−4/−3).
- Não há emissão de boleto/Pix nem conciliação bancária: a baixa é manual.
- Não existe reabertura de cobrança paga; um estorno exige novo lançamento.
- Sem trilha de auditoria por usuário (quem registrou o pagamento): fica como evolução.
