# Roadmap

Mapeia as seções do CRM original ([central/LEIA-ME.md](../reference/noxencrm-original/central/LEIA-ME.md)) para o novo projeto. Proposta de ordem; ajuste conforme prioridade do negócio.

| Fase | Conteúdo | Origem no original | Estado |
|---|---|---|---|
| 1 | Autenticação e papéis, leads (funil), clientes (carteira), painel com MRR e meta, outbox + RabbitMQ + Redis | `crm/leads.md`, `crm/carteira.md`, `clientes/*/perfil.md` | **Backend concluído e testado** |
| 1b | Frontend: login, painel, kanban de leads, lista e ficha de clientes | Central (Visão geral, Clientes, Prospecção) | **Concluído e conferido no navegador**, sem Figma (dispensado pelo responsável; o [arquivo Figma](https://www.figma.com/design/hWeWyT7Q9So3onOVEZwa33) tem só tokens e componentes base) |
| 2 | Financeiro: histórico de pagamentos por cliente (mensalidades, status, atraso), receitas avulsas e despesas | `clientes/*/financeiro.md`, `crm/financeiro-noxen.md` | Não iniciado |
| 2 | Reuniões, campanhas e resultados por cliente | `clientes/*/reunioes.md`, `campanhas.md`, `resultados.md` | Não iniciado |
| 3 | Prospecção: mensagens por lead (WhatsApp/Instagram), scripts comerciais, lembretes de follow-up (job agendado + fila) | `mensagens-prospeccao.json`, `scripts.md` | Não iniciado |
| 3 | Conteúdos, ideias, tarefas/planejamento e base estratégica | `conteudos.md`, `ideias.md`, `tarefas.md`, `base.md` | Não iniciado |
| 4 | Estúdio criativo (projetos, kits de marca, referências, upload de arquivos em armazenamento de objetos) | `estudio.json` | Não iniciado |
| 4 | Buscador de empresas (Google Maps Scraper Kit) como jobs na fila, importando para leads | `ferramentas/google-maps-scraper-kit` | Não iniciado; revisar LGPD e termos do Google antes |
| — | Importador dos arquivos `.md` do original para o banco | `modelos/crm`, dados reais fora do git | Não iniciado; dados reais exigem cuidado (LGPD) |

## Pendências técnicas conhecidas

- Limpeza periódica de `outbox_messages` processadas (ADR-0005).
- Remoção/anonimização de leads e clientes (LGPD): hoje não há exclusão.
- CI (build + testes) ainda não configurada.
- Tipos do frontend espelhados à mão dos DTOs: gerar o cliente TypeScript a partir do OpenAPI.
- Revisar o armazenamento do refresh token na SPA (hoje `localStorage`; ver ADR-0004) antes de produção.
- Kanban carrega até 50 leads por etapa; falta paginação por coluna quando passar disso.
- Sem tela de gestão de usuários (a API já tem `/api/users`, só Admin).
- Sem testes automatizados de interface (a conferência da fase 1 foi manual no navegador).
- Frontend não tem Dockerfile nem serviço no `docker-compose`.
