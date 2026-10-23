# ADR-0008: Sistema de design do frontend (tokens, tema claro/escuro, kit de UI, movimento)

- Status: Proposta (implementada)
- Data do registro: 2026-10-22

## Contexto

A primeira versão do frontend funcionava, mas era visualmente básica: um único `app.css`, componentes soltos em `ui.tsx`, sem estados de carregamento além de texto "Carregando…", sem tema escuro, sem sistema de movimento e sem critérios de tipografia, cor e hierarquia. O responsável pediu que as skills de design instaladas (UI UX Pro Max, Taste, princípios de movimento e redesign) fossem aplicadas a fundo. O Figma foi dispensado (ver AGENTS.md), então as decisões visuais vivem no código e neste registro.

## Decisão

- **Tokens em duas camadas** em `frontend/src/styles/tokens.css`: primitivos (neutros frios, uma cor de marca índigo, cores de status) e semânticos (`--bg-*`, `--text-*`, `--line`, `--status-*`). Os componentes só usam semânticos. Tema claro e escuro por `data-theme` (sistema/claro/escuro), com `theme-init.js` aplicando a escolha antes da primeira pintura para não piscar.
- **Cor**: um único acento (índigo). Verde/âmbar/vermelho existem só para significado (status, atraso), nunca como decoração. Contraste de texto ≥ 4,5:1 nos dois temas.
- **Tipografia**: Geist (texto) e Geist Mono (números e atalhos), auto-hospedadas via `@fontsource-variable`, com escala fixa e `tabular-nums` em valores.
- **Ícones**: Phosphor, uma família só, `aria-hidden` quando decorativos.
- **Forma**: escala de raios única (chips 6, controles 8, superfícies 12, diálogos 16). Cartões só onde a elevação comunica hierarquia; indicadores do painel são faixas separadas por linhas.
- **Movimento** (peso: Emil Kowalski, depois Jakub Krehel; SaaS de uso diário): CSS puro, curvas e durações em tokens (120/180/260 ms), só `transform` e `opacity`, feedback de pressão `scale(.97)`, diálogos com `@starting-style`, nada animado em ações por teclado frequentes, `prefers-reduced-motion` respeitado globalmente.
- **Estados**: skeletons com a forma do conteúdo final, estados vazios com próxima ação, erros com "Tentar de novo", barra de progresso fina no topo durante buscas, toasts só para eventos transitórios.
- **Layout**: casca com barra lateral agrupada (Geral, Comercial, Marketing, Agência) e painel principal em superfície inset; no celular a barra vira faixa superior de ícones. Formulários longos abrem em painel lateral; paleta de comandos (Ctrl/⌘ K) para navegar e criar.
- **Componentização**: `components/ui` (Button, Badge, Skeleton, Fields, Dialog, PageHeader, EmptyState, ErrorNote…) como único ponto de composição visual; páginas só montam.
- **Desempenho**: telas carregadas sob demanda por rota (`React.lazy`) com skeleton como fallback; bundle inicial de ~379 kB (115 kB gzip).
- **Acessibilidade**: link "pular para o conteúdo", foco movido ao conteúdo na troca de rota, rótulos em todos os controles, foco visível, alvos de toque confortáveis.

## Padrões de composição (adendo de 2026-10-22)

Uma revisão de consistência mostrou que, embora o cabeçalho fosse um componente só, as telas montavam filtros, botões de criar, datas, cartões e espaçamentos cada uma do seu jeito (botão principal em três posições, três estilos de filtro, sete contêineres de cartão com paddings diferentes, datas fatiadas à mão, carregamento por texto em algumas áreas). Decisões:

- **Ordem fixa na página**: cabeçalho (título, descrição, ação principal à direita), abas, `FilterBar`, conteúdo. Filtros nunca no cabeçalho; criação nunca na barra de filtros.
- **Componentes únicos**: `CreateButton`, `FilterBar`/`FilterSelect`/`FilterInput`/`FilterCheck`, `Card` (+ `SectionTitle`, `ItemTitle`), `DateValue` e `formatDate` (seis modos), `ICON`.
- **Datas**: um único módulo; datas relativas até 7 dias ("hoje", "em 3 dias", "venceu há 2 dias") e data completa além disso; "—" para ausente; colunas de data em `td.num`.
- **Tokens**: escala de espaçamento, raios e fontes aplicadas em todo o CSS (valores fora da escala foram arredondados para o degrau mais próximo); cores do botão de perigo viraram tokens.
- **Carregamento**: nenhum "Carregando…" em texto puro; sempre esqueleto ou `Loading`.
- **Quadros sem rolagem lateral** (2026-10-23): o Kanban de leads e o quadro do Estúdio rolavam na horizontal no meio da tela. Agora as colunas dividem a largura (5 abertas; Fechado e Perdido em faixa "Encerrados" abaixo) e, abaixo de 1280px, empilham. As abas deixaram de mostrar uma barra de rolagem residual, as grades de cartões são uma só (`.card-grid`), as tabelas têm linha de altura única e Ideias, Scripts, Conteúdos e tarefas ganharam busca e filtros no mesmo padrão.
- **Trava**: `src/lib/consistency.test.ts` lê o código-fonte e falha se alguém voltar a usar `Plus` à mão, tamanho de ícone numérico, fatiar data, classes antigas de filtro/cartão, `style` inline estático, ou cor, espaçamento, raio e fonte soltos no CSS.

## Alternativas consideradas

- Biblioteca de componentes pronta (shadcn/Radix, Fluent, Carbon): descartada por ora; o produto é pequeno, o CSS próprio com tokens é suficiente e evita dependência pesada. Reavaliar se o número de componentes crescer.
- Tailwind: descartado para não migrar o estilo existente de uma vez; os tokens CSS equivalem ao `@theme` e permitem migrar depois.
- Retomar o Figma antes de redesenhar: dispensado pelo responsável (limite do plano).

## Consequências

- O arquivo Figma (tokens Inter, indigo anterior) ficou **defasado**: o código é a fonte de verdade. Se o Figma voltar, regenerar as variáveis a partir de `tokens.css`.
- O `Dialog` usa uma referência para congelar o conteúdo durante a animação de saída; o oxlint acusa avisos de `react(refs)`/`set-state-in-effect` aceitos de forma consciente (a alternativa é perder a transição de saída).
- Temas, paleta de comandos e movimento são comportamento de produto: mudanças futuras devem passar por este registro.

## Verificação

`tsc -b`, `oxlint` (só avisos conhecidos), 36 testes do frontend (inclui a trava de consistência) e build passando; contêiner `web` reconstruído e conferido no navegador integrado: as 11 telas principais têm cabeçalho na mesma posição, uma ação principal, barra de filtros do mesmo componente, cartões com o mesmo padding e ícones na escala; tema claro e escuro, paleta de comandos e largura de celular conferidos na primeira rodada. A captura de tela do painel integrado é instável; boa parte da conferência foi por inspeção do DOM e dos estilos computados.
