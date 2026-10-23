# Paridade com o CRM original

Comparação feita em 2026-10-23 entre o CRM original ([reference/noxencrm-original](../reference/noxencrm-original): arquivos Markdown, a "Central" em `central/app.html`, geradores em Python e o agente "Diretor Noxen") e esta reescrita. Fontes lidas: `README.md`, `CLAUDE.md`, `central/LEIA-ME.md`, `.claude/agents/noxen-diretor.md`, `modelos/` e `clientes/_modelo/` (os dados reais não estão no repositório) e as telas de `central/app.html`.

Legenda: **Tem** (equivalente ou melhor), **Parcial**, **Falta**.

## Resumo

- O núcleo do negócio existe: meta de clientes ativos, MRR, funil de leads, carteira, mensalidades, receitas e despesas, reuniões, campanhas e resultados, tarefas, scripts, conteúdos, ideias, base e estúdio.
- A reescrita acrescenta o que os arquivos não tinham: login e papéis, vários usuários ao mesmo tempo sem conflito, histórico confiável, cobranças geradas sozinhas, eventos e cache.
- O que falta é principalmente **profundidade de cadastro** (a ficha do cliente e do lead do original tem muito mais campos), **visões** (lista da prospecção, calendário mensal, detalhe de conteúdo), **arquivos** (envio de imagens e vídeos no Estúdio) e o **buscador/importação de empresas**.

## Por módulo

### Visão geral (Painel)

| Original | Aqui |
|---|---|
| Clientes ativos x meta, barra e dias até o prazo | Tem |
| MRR e ticket médio | Parcial: MRR sim, ticket médio não |
| Prospecções em andamento e "quentes" (respondeu, reunião, proposta) | Parcial: leads em aberto e pipeline sim, "quentes" não |
| Tarefas pendentes e atrasadas; lista de prioridades altas | Falta no painel (as tarefas existem em Planejamento) |
| Próximas ações em 7 dias (reuniões, retornos, vencimentos) | Tem |
| Funil de prospecção, lista de clientes, panorama financeiro | Parcial: funil e carteira por status sim; pipeline estimado sim; lista de clientes com mensalidade não |

### Prospecção (leads)

| Original | Aqui |
|---|---|
| Etapas A contatar até Fechado/Perdido, origem, valor estimado, contato, WhatsApp, Instagram | Tem (em quadro Kanban com arrastar e soltar, também por teclado) |
| Lista com contadores por status, busca, filtro por grupo/nicho, "só retornos até hoje" | Parcial: busca, "só meus leads" e quadro; sem lista, sem grupo/nicho, sem filtro de retorno vencido |
| Atualizar andamento com **anotação** que vai para o histórico | Parcial: histórico só de mudanças de etapa; sem anotação livre |
| Mensagem personalizada por lead e botões WhatsApp / Direct do Instagram / copiar | Parcial: mensagem montada a partir dos scripts (com `{{empresa}}`, `{{contato}}`, `{{meu_nome}}`), WhatsApp e copiar; sem abrir Direct do Instagram |
| Campos "anuncia na Meta?", gancho/informação relevante, envio planejado, grupo | Falta |
| Tarefas, materiais e scripts relacionados ao lead | Falta na tela do lead (a tarefa já aceita vínculo com lead no banco) |
| Converter em cliente ("virou cliente") | Tem (com cópia dos dados) |

### Clientes

| Original | Aqui |
|---|---|
| Lista em cartões com filtros | Tem (tabela, busca e status) |
| Ficha: contato, razão social/CNPJ, cliente desde, responsável | Tem |
| Site, Instagram, Facebook, TikTok; botões Instagram, site e copiar e-mail | Falta |
| Contrato: serviços contratados, forma de pagamento, início, fidelidade, reajuste | Parcial: mensalidade, implementação e vencimento sim; o resto não |
| Negócio: o que vende, cliente ideal, diferenciais, concorrentes, sazonalidade, objetivo, necessidades | Falta (há só o campo de observações) |
| Marketing: tom de voz, pilares de conteúdo, o que funcionou, verba de anúncios | Falta |
| Acessos às plataformas (sem senhas) | Falta |
| Reuniões (pauta, decisões, pendências) | Tem (assunto, anotações, próximos passos) |
| Campanhas e resultados mensais | Tem (com custo por lead, custo por venda e ROAS calculados) |
| Financeiro do cliente | Tem |
| Conteúdos, tarefas e projetos criativos do cliente dentro da ficha | Falta |

### Financeiro

| Original | Aqui |
|---|---|
| KPIs do mês, vencimentos, pagamentos, receitas avulsas, despesas | Tem; cobranças são **geradas** todo mês pelo Worker e o atraso é calculado |
| Tabela "valores por cliente" com total | Falta |
| Categorias fixas de despesa (Anúncios, Ferramentas, Equipe, Escritório, Impostos, Outros) | Parcial: categoria livre |
| Forma de pagamento (Pix, boleto, cartão) | Falta |

### Planejamento

| Original | Aqui |
|---|---|
| Tarefas por prazo (atrasadas, hoje, 7 dias, adiante, sem data, concluídas) | Tem (agrupamento adicionado em 2026-10-23) |
| Filtros por tipo, prioridade, cliente e "mostrar concluídas" | Parcial: prioridade e "só abertas" |
| Visão em calendário mensal | Falta |
| Retornos comerciais, reuniões, vencimentos e publicações na agenda | Tem (agenda de 7, 14 ou 30 dias) |

### Scripts, conteúdos, ideias, base

| Original | Aqui |
|---|---|
| Scripts com filtros por etapa, canal, nicho e busca | Tem etapa, canal e busca; falta nicho |
| Conteúdos com filtros (cliente, formato, objetivo, status), busca e **página de detalhe** com texto completo, copiar e galeria | Parcial: busca, status e canal na lista; sem detalhe, sem galeria |
| Status extras de conteúdo (Entregue, Pronto para uso) e texto em Markdown | Falta |
| Ideias com filtros e ordem por prioridade | Tem (adicionado em 2026-10-23) |
| Base estratégica com índice lateral | Parcial: seções editáveis (melhor que o original, que era só leitura); sem índice |

### Estúdio criativo

| Original | Aqui |
|---|---|
| Quadro de projetos (Briefing até Entregue), tipos, briefing, direção visual | Tem |
| Storyboard com **imagem em cada quadro**; imagens e arquivos adicionais | Falta (só texto e links; o envio de arquivos não existe) |
| Envio por arrastar, colar ou clicar (PNG, JPG, WebP, GIF, SVG, MP4, WebM, PDF) | Falta |
| Kits de marca: cores (copiar hex), fontes com prévia, tom, elementos, logos | Parcial: cores e textos sim; sem prévia de fonte, logo só por link |
| Banco de referências com tags e cliente | Tem (por link, sem imagem) |
| Formatos mais usados e checklist de entrega; copiar briefing para o Diretor | Falta |
| Sugestão de quadros por IA | Falta |

### Buscador de empresas e importação

| Original | Aqui |
|---|---|
| Buscador do Google Maps (scraper local), buscas salvas, importar planilha CSV, "Adicionar à Prospecção" | Falta |

## O que só existe aqui

Autenticação com renovação de sessão e três papéis (Admin, Comercial, Marketing; Marketing não vê o financeiro), vários usuários ao mesmo tempo com controle de edição simultânea, banco relacional, cobranças geradas automaticamente, exclusão definitiva de lead (pedido de remoção de dados), fila de eventos e cache, paleta de comandos, tema escuro, interface adaptada ao celular e testes automatizados.

## O que não vale replicar

- **"Diretor Noxen", consolidar e atualizar a Central, geradores em Python, backup tar.gz**: existem por causa do modelo de arquivos. Com banco, as edições já são gravadas na hora; o backup passa a ser o do PostgreSQL.
- **Scraper do Google Maps**: o próprio original avisa que raspar o Maps vai contra os termos do Google e envolve dados pessoais (LGPD). Se houver interesse, o caminho seguro é **importar uma planilha CSV** de leads.

## Ordem sugerida

1. **Rápido** (principalmente interface): ticket médio e leads "quentes" no painel; tarefas atrasadas e prioridades no painel; filtros que faltam (nicho dos scripts, cliente/formato/objetivo dos conteúdos, tipo/cliente das tarefas); índice da base; abrir Direct do Instagram; copiar e-mail; "valores por cliente" com total; categorias fixas de despesa; status extras de conteúdo.
2. **Médio** (banco e interface): anotações no histórico do lead; ficha completa do cliente (negócio, marketing, contrato, redes, acessos sem senha); campos extras do lead (anuncia na Meta, gancho, envio planejado, grupo); detalhe de conteúdo; calendário mensal; lista da Prospecção; conteúdos, tarefas e projetos dentro da ficha do cliente; importação de CSV de leads.
3. **Maior**: envio de arquivos (armazenamento de objetos), storyboard com imagens, formatos e guias do Estúdio.
