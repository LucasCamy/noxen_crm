# ADR-0005: Outbox transacional + RabbitMQ; Redis como cache de leitura

- Status: Proposta (implementada)
- Data do registro: 2026-10-22
- Referências: pedido do responsável por fila (RabbitMQ) e cache (Redis)

## Contexto

Mudanças em leads e clientes precisam disparar efeitos assíncronos (hoje: invalidar o painel; no futuro: lembretes de follow-up, notificações, buscas de empresas). Publicar no broker dentro do handler pode perder o evento se o processo cair entre o commit e a publicação, ou publicar um evento de uma transação que falhou.

## Decisão

- **Outbox transacional:** cada mudança grava um `OutboxMessage` (jsonb) no mesmo `SaveChanges` da entidade. O `OutboxDispatcher` (Worker) lê lotes com `FOR UPDATE SKIP LOCKED`, publica no exchange `noxen.crm.events` (topic, mensagens persistentes, publisher confirms) e marca como processado. Falhas incrementam `Attempts`; após 10 tentativas a mensagem fica parada para inspeção.
- **RabbitMQ:** exchange topic `noxen.crm.events` com chaves `lead.*` e `client.*`; fila durável `crm.dashboard-cache`; mensagens rejeitadas vão para `crm.dead-letter` via `noxen.crm.events.dlx`.
- **Redis:** `IDistributedCache` guarda o resumo da carteira (`GET /api/dashboard/portfolio`) por até 5 minutos. O consumidor `DashboardCacheInvalidationConsumer` remove a chave quando chega um evento. Redis é descartável (sem persistência) e nada depende dele para correção.

## Alternativas consideradas

- Publicar direto do handler: descartada pelo risco de perda/duplicidade descrito acima.
- MassTransit/Wolverine: não avaliadas em detalhe; `RabbitMQ.Client` direto mantém a mecânica explícita e sem dependência de licenciamento. Revisar se a quantidade de consumidores crescer.
- Invalidar o cache direto na API: funcionaria hoje, mas dispensaria o exercício da fila que será necessária para os próximos consumidores.

## Consequências

- Entrega pelo menos uma vez: consumidores devem ser idempotentes. A ordem não é garantida entre instâncias do dispatcher.
- Há latência de ~1 s (polling) entre a mudança e a invalidação; o TTL de 5 min limita a defasagem se o Worker estiver parado. Uma leitura concorrente pode repovoar o cache com dado antigo logo antes da invalidação; o TTL a corrige.
- A tabela `outbox_messages` cresce: é preciso uma rotina de limpeza das mensagens processadas (ainda não implementada).
- O Worker passa a ser um componente operacional obrigatório para que o painel reflita mudanças com rapidez.

## Implementação e verificação

Implementado. `MessagingPipelineTests` executa o fluxo completo com PostgreSQL, RabbitMQ e Redis reais (Testcontainers). O Worker também foi executado contra o Docker Compose local e processou um evento real.
