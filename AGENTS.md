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
| Frontend | React 19 + Vite 8 + TypeScript, React Router, TanStack Query, dnd-kit, Phosphor Icons, Geist, CSS puro com tokens e tema claro/escuro (ADR-0008) | implementado: login, painel, leads (kanban), clientes, financeiro, planejamento, conteúdos, ideias, scripts, base, estúdio e usuários |

## Organização

- `backend/src/Noxen.Crm.Domain`: entidades e regras de negócio (sem dependências), por área: `Leads`, `Clients`, `Finance`, `Marketing` (reuniões, campanhas, resultados), `Workspace` (tarefas, ideias, scripts, conteúdos, base), `Studio`, `Identity`, `Outbox`. Lança `DomainException` em violações.
- `backend/src/Noxen.Crm.Infrastructure`: `CrmDbContext`, migrations, Redis, RabbitMQ, `OutboxDispatcher` e consumidores.
- `backend/src/Noxen.Crm.Api`: endpoints por funcionalidade (`Auth`, `Leads`, `Clients`, `Dashboard`, `Finance`, `Workspace`, `Studio`), DTOs e tratamento de erros.
- `backend/src/Noxen.Crm.Worker`: host que roda o dispatcher da outbox, os consumidores e o `MaintenanceService` (gera as mensalidades do mês e limpa a outbox antiga).
- `backend/tests/Noxen.Crm.Tests`: testes de domínio, de API (PostgreSQL real) e do pipeline outbox → RabbitMQ → Redis (108 testes passando na última execução).
- `frontend/src`: `lib` (cliente da API com refresh de token, tipos, regras de domínio, formatação), `auth`, `components` (`components/ui` = kit de UI; `Layout`, `CommandPalette`, `Toast`), `pages` (carregadas por rota com `React.lazy`) e `styles/` (`tokens.css` com tokens e temas, `base.css`, `components.css`, `layout.css`, `pages.css`). Telas novas montam componentes de `components/ui` e usam só tokens semânticos; sem cores ou durações soltas.
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
npm test                             # vitest (41 testes passando): formatação, scripts, links, regras de funil e consistência visual
npm run lint                         # oxlint (12 avisos conhecidos: fast refresh, Dialog e abertura por atalho)
```

`docker compose --profile app up -d --build` sobe a aplicação completa (migrate, API, Worker e web em http://localhost:8090). Executado e conferido pelo nginx: login, páginas de todas as fases, escrita, evento da outbox e geração das mensalidades pelo Worker. O serviço `migrate` aplica o bundle de migrations do EF Core e termina antes da API/Worker. A porta 8080 do host costuma estar ocupada por outros projetos: a API direta usa `API_HOST_PORT` (padrão 8081).

## Convenções

- Arquitetura em camadas simples ([ADR-0003](docs/adr/0003-camadas-e-modulos.md)). Não introduza Repository, Unit of Work, CQRS ou mediator sem um problema concreto.
- Toda mudança em lead/cliente grava um evento na outbox **na mesma transação** (`db.AddEvent(...)`). Nunca publique no RabbitMQ direto do handler.
- Consumidores de mensagens precisam ser idempotentes (a entrega é pelo menos uma vez).
- Ficha do cliente (ADR-0009): contrato e e-mail no `Client`; perfil (`ClientProfile`, 1:1, versão 0 = ainda não existe) e acessos (`ClientAccess`, só o lugar da senha, nunca a senha) em endpoints próprios; anotações do lead são imutáveis (`LeadNote`) e aparecem em `GET /api/leads/{id}/timeline`.
- Escrita concorrente: entidades editáveis têm `Version` (`xmin`); o cliente envia a versão lida e divergência retorna 409. Unicidade é garantida por índice no banco, não por consulta prévia.
- Enums trafegam e são gravados como texto. Datas com `DateTimeOffset`/`DateOnly`; valores em R$ com `decimal(14,2)`.
- Erros de regra → 422 (`DomainException`); validação de entrada → 400; conflito → 409; sempre `ProblemDetails`.
- Frontend: o estado do servidor fica no TanStack Query (chaves como `leads`, `clients`, `payments`, `ledger`, `tasks`, `contents`, `studio-*`; depois de mutar, invalide-as, de preferência com `useCrmMutation`). Os tipos de `src/lib/types.ts` espelham os DTOs da API à mão: ao mudar um DTO, atualize-os no mesmo trabalho. Cores, espaçamento e raios vêm só de variáveis CSS de `tokens.css`, nunca de valores soltos. As regras de funil em `lib/domain.ts` apenas espelham o domínio para retorno imediato; a API é a autoridade.
- **Padrão de página (ADR-0008, imposto por `src/lib/consistency.test.ts`)**: `PageHeader` com a ação principal sempre à direita (`CreateButton`; nas telas com abas, o rótulo muda com a aba); abas, se houver, logo abaixo; depois `FilterBar` com a ordem busca, selects (`FilterSelect`/`FilterInput`), segmentado, caixas (`FilterCheck`); por fim o conteúdo. Filtro nunca fica no cabeçalho e ação de criar nunca fica na barra de filtros. Estados vazios repetem a mesma ação com o mesmo `CreateButton`. Filtros: busca sempre primeiro; status curto (até 6 opções) usa `Segmented`, o resto usa `FilterSelect`; listas e grades com dados filtráveis oferecem ao menos busca. Quadros (Kanban) **nunca** rolam na horizontal: as colunas dividem a largura (`--cols`) e, abaixo de 1280px, empilham; etapas terminais ficam em faixa própria. Tabelas têm linha de 64px; grades de cartões usam `.card-grid`.
- **Componentes únicos**: `Card` (`title`/`action`; `padding="sm"` para cartões densos do Kanban), `SectionTitle` (h2/h3 de seção), `ItemTitle` (h3 de item), `.group-label` (rótulo de grupo em listas), `DateValue`/`formatDate` para qualquer data (modos `date`, `short`, `month`, `datetime`, `relative`, `due`), `EMPTY` ("—") para valor ausente em tabelas e fichas (cartões podem usar frase explícita, como "Sem próximo passo"), `ICON` para tamanho de ícone (14 meta, 16 controles, 18 navegação, 22 estado vazio). Não fatie texto de data nem use `toLocale*Date/TimeString` fora de `lib/format.ts`.
- **Tokens no CSS**: espaçamento só por `var(--space-*)`, raios por `var(--r-*)`, fontes por `var(--fs-*)`, cores só em `tokens.css`. `style={{…}}` só para valor dinâmico (variável CSS, `flex`, cor vinda de dado). Rótulos de campo de data seguem o domínio: Vencimento (cobrança), Prazo (tarefa), Entrega (estúdio), Publicação (conteúdo).
- **Carregamento e movimento (ADR-0010)**: toda tela tem esqueleto próprio em `components/skeletons.tsx` (mesmas classes, rótulos reais e altura de linha da tela final) e uma entrada em `RouteSkeleton`; colunas de tabela ficam em `lib/columns.ts` e alimentam cabeçalho e esqueleto. Animação só em `src/motion` (GSAP e Lenis carregados sob demanda, sempre dentro de `MOTION_OK`, sem `addEventListener('scroll')`). Regra de frequência: nada de entrada animada em listas e tabelas do dia a dia; o painel anima uma vez por sessão, o login pode ser expressivo, e a entrada por rolagem (`useScrollReveal`) só toca blocos abaixo da primeira tela. Diálogos novos precisam de `data-lenis-prevent`.
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
- Estado do arquivo (2026-10-22): página **Componentes** com variáveis (Primitives, Color, Spacing, Radius; sintaxe de código WEB `var(--...)`), 12 estilos de texto Inter e os componentes Icon, Button, Badge, Input e Search (node `2:173`). A página **Telas** está vazia: nenhuma tela existe no Figma, então **o código é a fonte de verdade visual** e o arquivo Figma pode estar defasado. Mantenha `tokens.css` e as variáveis do Figma alinhadas se um dos dois mudar. **Desde o redesign de 2026-10-22 (ADR-0008) o Figma está defasado**: o front passou a Geist, Phosphor, acento índigo e tema escuro, e o Figma ainda tem Inter e os tokens antigos; regenere o Figma a partir de `tokens.css` se ele voltar a ser usado.

## Validação

Use a [matriz do kit](reference/agent-project-kit/skills/project-workflow/references/validation.md). Em mudanças de API: caso válido, entrada inválida, autenticação/autorização e concorrência. Em fila/cache: o teste `MessagingPipelineTests` cobre o fluxo real com containers.

## Documentação e decisões

Mantenha a documentação alinhada ao comportamento implementado e identifique propostas como propostas. README para execução, OpenAPI (`/openapi/v1.json`, só em Development) para contratos HTTP e [docs/adr](docs/adr/README.md) para decisões duráveis. Numere ADRs sequencialmente (`NNNN-titulo-curto.md`), com contexto, decisão, alternativas e consequências; substitua em vez de reescrever. Não crie ADR para alterações triviais.

Mapa: [README](README.md) · [roadmap](docs/roadmap.md) · [ADRs](docs/adr/README.md) · [paridade com o CRM original](docs/paridade-com-o-original.md).
