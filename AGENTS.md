# Noxen CRM — instruções para agentes

CRM da Noxen Assessoria (agência de marketing): leads e prospecção, carteira de clientes, MRR e meta de clientes ativos. Reescrita completa do CRM baseado em arquivos Markdown de [reference/noxencrm-original](reference/noxencrm-original); a decisão está na [ADR-0001](docs/adr/0001-reconstruir-crm-como-aplicacao.md). Idioma do produto e da documentação: português do Brasil.

## Fluxo de trabalho (kit de skills)

Este projeto segue o [Agent Project Kit](reference/agent-project-kit/README.md), clonado em `reference/agent-project-kit`. Ao iniciar uma tarefa, leia `reference/agent-project-kit/skills/project-workflow/SKILL.md` e os módulos que ela indicar (front-end, banco, documentação, .NET). As regras comuns estão em `skills/project-workflow/references/common.md` do kit.

## Stack

| Camada | Tecnologia | Estado |
|---|---|---|
| API | .NET 10, ASP.NET Core minimal APIs, EF Core 10 | implementada |
| Worker | .NET 10 Worker Service (outbox → RabbitMQ → consumidores) | implementado |
| Banco | PostgreSQL 17 | implementado |
| Cache | Redis 7 (`IDistributedCache`) | implementado |
| Fila | RabbitMQ 4 (exchange topic + dead-letter) | implementado |
| Frontend | React 19 + Vite 8 + TypeScript, React Router, TanStack Query, dnd-kit, lucide-react, CSS puro com tokens | implementado: login, painel, leads (kanban), clientes, financeiro, planejamento, conteúdos, ideias, scripts, base, estúdio e usuários |

## Organização

- `backend/src/Noxen.Crm.Domain`: entidades e regras de negócio (sem dependências), por área: `Leads`, `Clients`, `Finance`, `Marketing` (reuniões, campanhas, resultados), `Workspace` (tarefas, ideias, scripts, conteúdos, base), `Studio`, `Identity`, `Outbox`. Lança `DomainException` em violações.
- `backend/src/Noxen.Crm.Infrastructure`: `CrmDbContext`, migrations, Redis, RabbitMQ, `OutboxDispatcher` e consumidores.
- `backend/src/Noxen.Crm.Api`: endpoints por funcionalidade (`Auth`, `Leads`, `Clients`, `Dashboard`, `Finance`, `Workspace`, `Studio`), DTOs e tratamento de erros.
- `backend/src/Noxen.Crm.Worker`: host que roda o dispatcher da outbox, os consumidores e o `MaintenanceService` (gera as mensalidades do mês e limpa a outbox antiga).
- `backend/tests/Noxen.Crm.Tests`: testes de domínio, de API (PostgreSQL real) e do pipeline outbox → RabbitMQ → Redis (84 testes passando na última execução).
- `frontend/src`: `lib` (cliente da API com refresh de token, tipos, regras de domínio, formatação), `auth`, `components`, `pages`, `styles/tokens.css` (tokens) e `styles/app.css`.
- `docs/adr`: decisões de arquitetura. `reference/`: material de consulta somente leitura (CRM original e o kit).

## Comandos

Todos executados nesta máquina (Windows, .NET SDK 10.0.402, Docker 29) durante a criação do projeto, salvo quando indicado.

```bash
cp .env.example .env                 # valores só de desenvolvimento
docker compose up -d                 # PostgreSQL, Redis e RabbitMQ (portas em 127.0.0.1)
cd backend
dotnet build
dotnet test                          # exige Docker (Testcontainers)
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/Noxen.Crm.Api --no-launch-profile --urls http://localhost:5080
DOTNET_ENVIRONMENT=Development dotnet run --project src/Noxen.Crm.Worker --no-launch-profile
dotnet ef migrations add <Nome> -p src/Noxen.Crm.Infrastructure -s src/Noxen.Crm.Api -o Persistence/Migrations
```

Frontend (em `frontend/`; Node 24, `npm install` já executado). Com a API em `http://localhost:5080`, o Vite faz proxy de `/api` (variável `VITE_API_PROXY` muda o destino):

```bash
npm run dev -- --host 127.0.0.1      # http://127.0.0.1:5173
npm run build                        # tsc -b + vite build
npm test                             # vitest (27 testes passando): formatação, scripts, links e regras de funil
npm run lint                         # oxlint (2 avisos de fast refresh conhecidos)
```

`docker compose --profile app up -d --build` sobe a aplicação completa (migrate, API, Worker e web em http://localhost:8090). Executado e conferido pelo nginx: login, páginas de todas as fases, escrita, evento da outbox e geração das mensalidades pelo Worker. O serviço `migrate` aplica o bundle de migrations do EF Core e termina antes da API/Worker. A porta 8080 do host costuma estar ocupada por outros projetos: a API direta usa `API_HOST_PORT` (padrão 8081).

## Convenções

- Arquitetura em camadas simples ([ADR-0003](docs/adr/0003-camadas-e-modulos.md)). Não introduza Repository, Unit of Work, CQRS ou mediator sem um problema concreto.
- Toda mudança em lead/cliente grava um evento na outbox **na mesma transação** (`db.AddEvent(...)`). Nunca publique no RabbitMQ direto do handler.
- Consumidores de mensagens precisam ser idempotentes (a entrega é pelo menos uma vez).
- Escrita concorrente: entidades editáveis têm `Version` (`xmin`); o cliente envia a versão lida e divergência retorna 409. Unicidade é garantida por índice no banco, não por consulta prévia.
- Enums trafegam e são gravados como texto. Datas com `DateTimeOffset`/`DateOnly`; valores em R$ com `decimal(14,2)`.
- Erros de regra → 422 (`DomainException`); validação de entrada → 400; conflito → 409; sempre `ProblemDetails`.
- Frontend: o estado do servidor fica no TanStack Query (chaves como `leads`, `clients`, `payments`, `ledger`, `tasks`, `contents`, `studio-*`; depois de mutar, invalide-as, de preferência com `useCrmMutation`). Os tipos de `src/lib/types.ts` espelham os DTOs da API à mão: ao mudar um DTO, atualize-os no mesmo trabalho. Cores, espaçamento e raios vêm só de variáveis CSS de `tokens.css`, nunca de valores soltos. As regras de funil em `lib/domain.ts` apenas espelham o domínio para retorno imediato; a API é a autoridade.
- O refresh token é rotativo: nunca chame `/api/auth/refresh` fora de `restoreSession()` (ele serializa as chamadas; duas simultâneas derrubam a sessão por suspeita de reuso).
- Código e mensagens ao usuário em português; identificadores de código em inglês, exceto termos do domínio já usados (`Comercial`, `Implementacao`, `AContatar`).

## Banco e migrations

- `Database:MigrateOnStartup` é `true` somente em `appsettings.Development.json` e nos testes. Em qualquer outro ambiente a migration é aplicada de forma explícita e autorizada (`dotnet ef database update`, script revisado ou o bundle do serviço `migrate` do Compose, que é o caminho dos contêineres locais; ver [ADR-0007](docs/adr/0007-migracoes-em-conteineres.md)).
- Criar a migration, revisar o SQL (`dotnet ef migrations script`) e aplicar são passos distintos. Não aplique em banco compartilhado ou de produção sem autorização.

## Segurança e configuração

- Segredos nunca entram no repositório. `.env` está no `.gitignore`; `.env.example` e `appsettings.Development.json` contêm **apenas valores de desenvolvimento local**.
- Obrigatórios fora de desenvolvimento: `ConnectionStrings__Postgres`, `ConnectionStrings__Redis`, `Jwt__Key` (32+ caracteres), `RabbitMq__User/Password` (Worker). Não há senha padrão: o primeiro Admin só é criado se `AdminSeed__Email` e `AdminSeed__Password` forem informados e não existir nenhum usuário.
- Autenticação e papéis: [ADR-0004](docs/adr/0004-autenticacao-e-papeis.md). Papéis: `Admin` (tudo, usuários, geração de mensalidades, exclusão de lead), `Comercial` (escreve leads, clientes e financeiro), `Marketing` (lê leads/clientes; **não vê o financeiro**; escreve campanhas, resultados, reuniões, conteúdos, ideias, scripts, base e estúdio). Políticas: `AdminOnly`, `CanWriteCrm`, `CanWriteMarketing`, `CanManageFinance`. A política padrão exige usuário autenticado em tudo; rotas públicas usam `AllowAnonymous` explicitamente.
- Dados reais de clientes/leads do projeto original (`crm/`, `clientes/`, backups) **não** devem ser copiados para este repositório.

## Interface (Figma + Playwright)

Preferência do kit: toda mudança visual é estruturada no Figma antes do código e conferida no navegador com Playwright.

**Exceção decidida pelo responsável em 2026-10-22: o Figma foi dispensado** (o plano Starter esgotou o limite de chamadas do MCP e o responsável pediu para pular a etapa). Todas as telas atuais foram feitas direto em código, usando os mesmos tokens do arquivo Figma como variáveis CSS (`frontend/src/styles/tokens.css`) e conferidas no navegador integrado do app, em contêineres. Se o responsável retomar o Figma, valem as regras do kit para as telas novas.

- Arquivo Figma do projeto: [Noxen CRM](https://www.figma.com/design/hWeWyT7Q9So3onOVEZwa33) (chave `hWeWyT7Q9So3onOVEZwa33`, plano Starter da conta de Lucas Camy).
- Estado do arquivo (2026-10-22): página **Componentes** com variáveis (Primitives, Color, Spacing, Radius; sintaxe de código WEB `var(--...)`), 12 estilos de texto Inter e os componentes Icon, Button, Badge, Input e Search (node `2:173`). A página **Telas** está vazia: nenhuma tela existe no Figma, então **o código é a fonte de verdade visual** e o arquivo Figma pode estar defasado. Mantenha `tokens.css` e as variáveis do Figma alinhadas se um dos dois mudar.

## Validação

Use a [matriz do kit](reference/agent-project-kit/skills/project-workflow/references/validation.md). Em mudanças de API: caso válido, entrada inválida, autenticação/autorização e concorrência. Em fila/cache: o teste `MessagingPipelineTests` cobre o fluxo real com containers.

## Documentação e decisões

Mantenha a documentação alinhada ao comportamento implementado e identifique propostas como propostas. README para execução, OpenAPI (`/openapi/v1.json`, só em Development) para contratos HTTP e [docs/adr](docs/adr/README.md) para decisões duráveis. Numere ADRs sequencialmente (`NNNN-titulo-curto.md`), com contexto, decisão, alternativas e consequências; substitua em vez de reescrever. Não crie ADR para alterações triviais.

Mapa: [README](README.md) · [roadmap](docs/roadmap.md) · [ADRs](docs/adr/README.md).
