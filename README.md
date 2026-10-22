# Noxen CRM

CRM da Noxen Assessoria: funil de leads, carteira de clientes, MRR e meta de clientes ativos. Reescrita do [CRM original](reference/noxencrm-original) (arquivos Markdown + página HTML gerada) como aplicação com API, PostgreSQL, Redis e RabbitMQ.

**Estado:** fase 1 pronta de ponta a ponta: backend (autenticação, leads, clientes, painel da carteira, fila e cache) e frontend (login, painel, kanban de leads, clientes). Veja o [roadmap](docs/roadmap.md).

## Material de referência (fora do git)

A pasta `reference/` não é versionada. Para ter o contexto que o `AGENTS.md` cita, clone ao lado do código:

```bash
git clone https://github.com/LucasCamy/agent-project-kit.git reference/agent-project-kit
git clone https://github.com/gabrielspares159-cell/noxencrm.git reference/noxencrm-original
```

## Rodar localmente

Pré-requisitos: Docker, .NET SDK 10.

```bash
cp .env.example .env              # valores só de desenvolvimento
docker compose up -d              # PostgreSQL, Redis e RabbitMQ
cd backend
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/Noxen.Crm.Api --no-launch-profile --urls http://localhost:5080
```

Em outro terminal, o Worker (publica os eventos da outbox e invalida o cache):

```bash
cd backend
DOTNET_ENVIRONMENT=Development dotnet run --project src/Noxen.Crm.Worker --no-launch-profile
```

E o frontend (o Vite repassa `/api` para a API em `localhost:5080`):

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1    # http://127.0.0.1:5173
```

Em `Development` a API aplica as migrations ao subir e cria o usuário `admin@noxen.local` (senha de desenvolvimento em `appsettings.Development.json`). Documentação OpenAPI: `http://localhost:5080/openapi/v1.json`.

| Serviço | Endereço |
|---|---|
| API | http://localhost:5080 |
| RabbitMQ (console) | http://localhost:15672 (usuário/senha do `.env`) |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Aplicação completa em contêineres (migrate → API e Worker → nginx com o frontend):

```bash
cp .env.example .env     # defina JWT_KEY (32+ caracteres) e, no primeiro uso, ADMIN_EMAIL e ADMIN_PASSWORD
docker compose --profile app up -d --build
```

| Serviço | Endereço |
|---|---|
| Aplicação (nginx + SPA + proxy `/api`) | http://localhost:8090 |
| API direta | http://localhost:8081 (`API_HOST_PORT` muda a porta; a 8080 costuma estar ocupada) |

O serviço `migrate` aplica as migrations com um bundle do EF Core e termina; a API e o Worker só sobem depois dele. Em produção, rode o mesmo bundle de forma explícita e autorizada, nunca como efeito colateral de subir a aplicação.

## Testes

```bash
cd backend
dotnet test    # exige Docker: sobe PostgreSQL, RabbitMQ e Redis temporários

cd ../frontend
npm test       # vitest: formatação e regras de funil
npm run build  # checagem de tipos + build de produção
```

## API (fase 1)

Todas as rotas exigem token `Bearer`, exceto login, refresh, logout e `/health/*`.

| Rota | Quem | O que faz |
|---|---|---|
| `POST /api/auth/login` · `refresh` · `logout` · `GET /api/auth/me` | público / autenticado | sessão com access token (15 min) e refresh rotativo |
| `GET/POST /api/users` · `POST /api/users/{id}/deactivate` | Admin | gestão de usuários; `GET /api/users/lookup` (id e nome) para qualquer autenticado |
| `GET /api/leads` (`stage`, `search`, `ownerId`, `page`, `pageSize`) · `GET /api/leads/{id}` · `/history` | autenticado | funil de prospecção |
| `POST /api/leads` · `PUT /api/leads/{id}` · `POST /api/leads/{id}/stage` | Admin, Comercial | cria, edita (com `version`) e move de etapa |
| `POST /api/leads/{id}/convert` | Admin, Comercial | fecha o lead e cria o cliente (idempotente) |
| `GET /api/clients` · `GET /api/clients/{id}` | autenticado | carteira |
| `POST /api/clients` · `PUT /api/clients/{id}` · `POST /api/clients/{id}/status` | Admin, Comercial | cadastro e ciclo de vida do cliente |
| `GET /api/dashboard/portfolio` | autenticado | clientes ativos vs meta, MRR, leads por etapa, follow-ups vencidos (cache no Redis) |
| `GET /api/payments` · `POST /api/clients/{id}/payments` · `PUT /api/payments/{id}` · `POST /api/payments/{id}/pay` · `/cancel` | Admin, Comercial | cobranças dos clientes (atraso derivado; uma mensalidade ativa por cliente/mês) |
| `GET/POST/PUT /api/ledger` · `POST /api/ledger/{id}/settle` · `/cancel` | Admin, Comercial | receitas avulsas e despesas da agência |
| `GET /api/finance/summary?month=AAAA-MM` · `POST /api/finance/charges/generate` | Admin, Comercial · só Admin | caixa do mês; geração manual das mensalidades (o Worker também gera todo mês) |
| `/api/clients/{id}/meetings` · `/campaigns` · `/results` (+ `PUT/DELETE` em `/api/meetings`, `/campaigns`, `/results`) | leitura: todos · escrita: todos os papéis | reuniões, campanhas e resultados mensais (CPL, custo por venda e ROAS) |
| `/api/tasks` · `/api/ideas` · `/api/scripts` · `/api/contents` · `/api/knowledge` | leitura: todos · escrita: todos os papéis | tarefas, ideias, scripts comerciais, conteúdos e base estratégica |
| `GET /api/planning?from&to` | autenticado | agenda unificada: tarefas, follow-ups, reuniões, vencimentos (só Admin/Comercial) e publicações, com atrasados |

Etapas do lead: `AContatar → Contatado → Respondeu → ReuniaoMarcada → PropostaEnviada → Fechado | Perdido`. Perdido exige motivo; Fechado só pela conversão em cliente. Status do cliente: `Implementacao`, `Ativo`, `Pausado`, `Encerrado`. O MRR soma as mensalidades dos clientes `Ativo`. Meta e prazo vêm de `Portfolio:TargetClients` e `Portfolio:Deadline` (padrão: 10 clientes até 30/11/2026).

## Estrutura

```
backend/        solução .NET (Domain, Infrastructure, Api, Worker, Tests)
frontend/       React + Vite + TypeScript (login, painel, leads, clientes)
docs/           ADRs e roadmap
reference/      CRM original e o Agent Project Kit (somente consulta)
docker-compose.yml
AGENTS.md       instruções para agentes (fluxo, convenções, segurança)
```
