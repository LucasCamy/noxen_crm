# Roadmap

Mapeia as seções do CRM original ([central/LEIA-ME.md](../reference/noxencrm-original/central/LEIA-ME.md)) para o novo projeto.

| Fase | Conteúdo | Origem no original | Estado |
|---|---|---|---|
| 1 | Autenticação e papéis, leads (funil), clientes (carteira), painel com MRR e meta, outbox + RabbitMQ + Redis; frontend de login, painel, kanban e clientes | `crm/leads.md`, `crm/carteira.md`, `clientes/*/perfil.md` | **Concluída** (sem Figma: dispensado pelo responsável; o [arquivo Figma](https://www.figma.com/design/hWeWyT7Q9So3onOVEZwa33) tem só tokens e componentes base) |
| 2 | Financeiro: cobranças por cliente (atraso derivado, mensalidade gerada pelo Worker), receitas avulsas, despesas e resumo do mês; reuniões, campanhas e resultados mensais por cliente; gestão de usuários | `clientes/*/financeiro.md`, `reunioes.md`, `campanhas.md`, `resultados.md`, `crm/financeiro-noxen.md` | **Concluída** |
| 3 | Planejamento (agenda unificada + tarefas), conteúdos, ideias, scripts comerciais com gerador de mensagem de abordagem no lead, base estratégica | `central/conteudo/*.md`, `mensagens-prospeccao.json` | **Concluída** |
| 4 | Estúdio criativo: projetos (briefing → entregue), kits de marca e referências, **por link** | `estudio.json` | **Concluída** (sem upload de arquivos) |
| 4 | Buscador de empresas (Google Maps) | `ferramentas/google-maps-scraper-kit` | **Não será feito como no original** (ver abaixo) |
| — | Importador dos arquivos `.md` do original para o banco | `modelos/crm`, dados reais fora do git | Não iniciado; exige os dados reais e cuidado com LGPD |

## Decisões sobre o que ficou de fora

- **Buscador do Google Maps:** o próprio original registra que raspar o Maps vai contra os termos do Google e que os dados são pessoais (LGPD). Não implementei. A alternativa legítima é a API oficial (Google Places) com chave e faturamento próprios, a decidir.
- **Upload de arquivos (imagens, vídeos, PDFs do estúdio):** exige armazenamento de objetos (ex.: MinIO/S3), varredura de arquivos e política de retenção. O estúdio atual guarda só links (http/https validados no servidor e na interface).
- **Importador de dados reais:** não tenho os dados (ficam fora do git do original); precisa de formato de entrada confirmado e de revisão de LGPD antes de rodar.

## Pendências técnicas conhecidas

- Tipos do frontend espelhados à mão dos DTOs: gerar o cliente TypeScript a partir do OpenAPI.
- Revisar o armazenamento do refresh token na SPA (hoje `localStorage`; ver ADR-0004) antes de produção.
- Kanban carrega até 50 leads por etapa; falta paginação por coluna quando passar disso.
- Sem testes automatizados de interface (a conferência foi manual no navegador, em contêineres).
- O workflow de CI (`.github/workflows/ci.yml`) foi escrito mas **não foi executado** (só roda no GitHub).
- Lembretes de follow-up por notificação (hoje só aparecem na agenda e no painel).
- Autorização é por papel; não há restrição por responsável (todo usuário de escrita edita tudo).
- Exclusão: tarefas, ideias, scripts, conteúdos, base, reuniões, campanhas e resultados podem ser apagados (sem lixeira). Leads podem ser excluídos por um Admin (se não viraram cliente); clientes não têm exclusão (LGPD: remoção/anonimização de clientes e das cobranças, que têm obrigação fiscal, ainda por definir).
