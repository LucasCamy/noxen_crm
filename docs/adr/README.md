# Decisões de arquitetura (ADR)

| # | Decisão | Status |
|---|---|---|
| [0001](0001-reconstruir-crm-como-aplicacao.md) | Reconstruir o CRM como aplicação com banco de dados | Aceita |
| [0002](0002-stack-dotnet-react-postgresql.md) | Stack: .NET 10, React + Vite + TypeScript, PostgreSQL | Aceita |
| [0003](0003-camadas-e-modulos.md) | API e Worker em camadas simples, sem Repository/mediator | Proposta |
| [0004](0004-autenticacao-e-papeis.md) | Identity + JWT curto + refresh rotativo; três papéis; um único tenant | Proposta |
| [0005](0005-outbox-rabbitmq-e-cache-redis.md) | Outbox transacional + RabbitMQ; Redis como cache de leitura | Proposta |
| [0006](0006-cobrancas-e-lancamentos.md) | Cobranças e lançamentos separados; atraso derivado; mensalidade gerada pelo Worker | Proposta |
| [0007](0007-migracoes-em-conteineres.md) | Migrations aplicadas por um serviço `migrate` (bundle do EF Core) | Proposta |
| [0008](0008-sistema-de-design-do-frontend.md) | Sistema de design: tokens, tema claro/escuro, kit de UI, movimento, estados | Proposta |
| [0009](0009-ficha-do-cliente-e-anotacoes-do-lead.md) | Ficha completa do cliente (contrato, perfil, acessos) e anotações no histórico do lead | Proposta |
| [0010](0010-esqueletos-por-tela-e-camada-de-movimento.md) | Esqueletos fiéis a cada tela e camada de movimento (Lenis, ScrollTrigger, linhas do tempo) | Proposta |

"Aceita" = escolha confirmada pelo responsável do projeto. "Proposta" = já implementada pelo agente seguindo o pedido, aguardando confirmação explícita. Aceita não implica implantada.
