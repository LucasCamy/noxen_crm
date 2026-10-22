# ADR-0002: Stack — .NET 10, React + Vite + TypeScript, PostgreSQL

- Status: Aceita
- Data do registro: 2026-10-22
- Responsáveis: Lucas Camy

## Contexto

O kit de skills do projeto tem módulos para .NET e EF Core. O pedido inclui banco, frontend, backend, fila (RabbitMQ) e cache (Redis). Máquina de desenvolvimento com .NET SDK 10, Node 24 e Docker.

## Decisão

- Backend: .NET 10 com ASP.NET Core minimal APIs e EF Core 10 (Npgsql).
- Frontend: React + Vite + TypeScript, SPA consumindo a API (a ser desenhado no Figma antes do código).
- Banco: PostgreSQL 17.
- Infra local: Docker Compose com PostgreSQL, Redis e RabbitMQ.

As escolhas de frontend e banco foram confirmadas pelo responsável entre as opções apresentadas.

## Alternativas consideradas

- Frontend: Next.js (SSR desnecessário para um painel interno), Angular, Blazor (menos componentes prontos e fluxo Figma-para-código menos direto). 
- Banco: SQL Server (imagem pesada e licença em produção).

## Consequências

- PostgreSQL oferece `jsonb`, índices parciais e `xmin` (usado como token de concorrência otimista); amarra o modelo a recursos do PostgreSQL.
- Duas toolchains (dotnet e node) e um contrato HTTP a manter entre elas; recomenda-se gerar o cliente TypeScript a partir do OpenAPI.
- Versões de pacotes fixadas pelo NuGet no momento da criação (EF Core/ASP.NET 10.0.13, Npgsql 10.0.3, RabbitMQ.Client 7.2.2).
