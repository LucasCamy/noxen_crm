# Decisões de arquitetura (ADR)

| # | Decisão | Status |
|---|---|---|
| [0001](0001-reconstruir-crm-como-aplicacao.md) | Reconstruir o CRM como aplicação com banco de dados | Aceita |
| [0002](0002-stack-dotnet-react-postgresql.md) | Stack: .NET 10, React + Vite + TypeScript, PostgreSQL | Aceita |
| [0003](0003-camadas-e-modulos.md) | API e Worker em camadas simples, sem Repository/mediator | Proposta |
| [0004](0004-autenticacao-e-papeis.md) | Identity + JWT curto + refresh rotativo; três papéis; um único tenant | Proposta |
| [0005](0005-outbox-rabbitmq-e-cache-redis.md) | Outbox transacional + RabbitMQ; Redis como cache de leitura | Proposta |

"Aceita" = escolha confirmada pelo responsável do projeto. "Proposta" = já implementada pelo agente seguindo o pedido, aguardando confirmação explícita. Aceita não implica implantada.
