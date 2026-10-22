# ADR-0007: Migrations aplicadas por um serviço `migrate` (bundle do EF Core) nos contêineres

- Status: Proposta (implementada)
- Data do registro: 2026-10-22

## Contexto

A API só aplica migrations sozinha em Development (`Database:MigrateOnStartup`). O Docker Compose precisa subir a aplicação completa do zero sem depender de ferramentas na máquina e sem que a API tenha permissão ou comportamento de migrar o banco em produção. Aplicar migrations é uma operação com impacto em dados e deve ser explícita.

## Decisão

O `backend/Dockerfile` gera um **bundle de migrations** (`dotnet ef migrations bundle`, executável único e autocontido) em um estágio `migrate`. No `docker-compose.yml` o serviço `migrate` roda o bundle contra o PostgreSQL e termina; `api` e `worker` dependem de `migrate` com `condition: service_completed_successfully`. A API não migra nada nos contêineres (`DATABASE_MIGRATE_ON_STARTUP=false` por padrão).

## Alternativas consideradas

- Migrar na inicialização da API em qualquer ambiente: descartada; mistura implantação com execução e dá à aplicação mais poder do que precisa.
- Script SQL gerado e aplicado à mão: continua válido para produção com revisão; o bundle usa as mesmas migrations e é o caminho prático local/CI.
- Imagem do SDK com `dotnet ef database update` em runtime: descartada pelo tamanho e por exigir as fontes no contêiner.

## Consequências

- A imagem `migrate` fica mais pesada (executável autocontido, ~70 MB), mas só é usada na implantação.
- Cada migration precisa ser compatível com a versão anterior da aplicação se houver implantação gradual (expand/contract); o bundle não faz rollback.
- Em produção, o bundle deve rodar como etapa autorizada do pipeline, antes de subir novas versões da API/Worker; nunca como efeito colateral.

## Verificação

Executado localmente: o `migrate` aplicou as migrations de cada fase em um banco já existente (apenas as pendentes) e a API/Worker subiram depois dele.
