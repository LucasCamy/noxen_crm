# ADR-0003: API e Worker em camadas simples, sem Repository/mediator

- Status: Proposta (implementada)
- Data do registro: 2026-10-22

## Contexto

O kit orienta a não introduzir Repository, Unit of Work, CQRS ou mediator sem problema concreto. O domínio atual é pequeno (leads, clientes, usuários, outbox) e há dois processos que compartilham persistência e mensageria: API e Worker.

## Decisão

Quatro projetos: `Domain` (entidades e regras, sem dependências), `Infrastructure` (EF Core, Redis, RabbitMQ, outbox), `Api` e `Worker` (ambos dependem de Infrastructure). Os handlers da API usam o `CrmDbContext` diretamente; regras de negócio ficam nas entidades de domínio. Não há camada `Application` separada.

## Alternativas consideradas

- Clean Architecture completa com camada Application, repositórios e mediator: descartada por adicionar indireção sem problema concreto hoje.
- Projeto único: descartada porque o Worker precisa reutilizar persistência e mensageria sem carregar o ASP.NET.

## Consequências

- Menos código e menos arquivos por funcionalidade; consultas ficam visíveis nos endpoints.
- Os handlers conhecem o EF Core; se a lógica de orquestração crescer (muitos casos de uso compartilhados entre API e Worker), extrair uma camada Application em nova ADR.
- Testes de API usam PostgreSQL real, o que dá confiança em consultas e concorrência à custa de tempo de execução (~1 min).
