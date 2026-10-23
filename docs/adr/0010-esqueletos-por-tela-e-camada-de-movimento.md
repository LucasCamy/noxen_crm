# ADR-0010: Esqueletos fiéis a cada tela e camada de movimento (Lenis, ScrollTrigger, linhas do tempo)

- Status: Proposta (implementada)
- Data do registro: 2026-10-23

## Contexto

Duas queixas: os esqueletos de carregamento eram genéricos (uma tabela com número de colunas fixo, uma lista de tarefas usada para tudo, um bloco de barras no carregamento da rota) e não repetiam o layout de cada tela, o que causava salto ao chegar o conteúdo; e a interface não tinha rolagem suave, entrada por rolagem nem progresso de leitura. A análise das skills instaladas (movimento: Emil Kowalski, Jakub Krehel e Jhey Tompkins; taste; redesign; UI UX Pro Max, domínio `gsap` e guias de UX) trouxe os critérios abaixo.

## O que as skills pedem e como foi aplicado

- **Esqueleto com a forma do conteúdo final** (taste, UX "content jumping" e "loading indicators"): cada tela tem o seu esqueleto, com as mesmas classes, rótulos reais onde o texto é fixo (cabeçalhos de tabela, títulos, abas, nomes de etapa) e a mesma altura de linha (64px). As colunas das tabelas vêm de uma lista única (`lib/columns.ts`) que alimenta o cabeçalho real e o esqueleto. O carregamento da rota (`RouteSkeleton`, escolhido pelo caminho) e o da própria tela usam o mesmo corpo, então não há salto entre os dois. Verificado no navegador: cabeçalho, filtros, abas e tabela têm a mesma posição e altura antes e depois dos dados.
- **Sem piscar em respostas rápidas** (UX "loading feedback should match the expected wait"): o esqueleto só aparece depois de 150ms (`.skeleton-root`, atraso em CSS).
- **A frequência manda** (frequency gate, Emil): telas abertas dezenas de vezes por dia não ganham entrada animada a cada visita. O painel anima **uma vez por sessão**; o login, raro, pode ser expressivo; listas e tabelas do dia a dia não animam.
- **Nada de animação de montagem para conteúdo estático, nem stagger em toda lista** (anti-checklist): a entrada por rolagem só atinge blocos que estão abaixo da primeira tela e só dispara quando entram na viewport; o que já está visível nunca espera por animação.
- **Rolagem: duração fixa, não presa à velocidade** (cookbook, scroll-driven): as entradas disparam por posição e rodam 0,35s; só o indicador de progresso acompanha a rolagem (`scrub`), como orientação.
- **Sem `scroll` na mão** (taste): nenhum `addEventListener('scroll')`; só Lenis, ScrollTrigger e `ResizeObserver`.
- **`prefers-reduced-motion` na mesma entrega** (acessibilidade): toda animação roda dentro de `gsap.matchMedia(MOTION_OK)`; sem movimento, o estado final aparece direto, o Lenis não liga e o navegador volta a suavizar âncoras. O Lenis também só liga com mouse/trackpad (`hover: hover` e `pointer: fine`).
- **GSAP isolado e com limpeza** (taste): vive só em `src/motion`, carregado sob demanda (fora do pacote inicial: ~120 kB em chunk próprio, ~47 kB gzip, depois da primeira pintura), com `gsap.context`/`matchMedia` revertidos ao sair e `SplitText.revert()` no login. Nunca misturado com outra biblioteca de animação.

## Decisão

- **Lenis** (rolagem suave "pesada e fluida": duração 1,15s, curva exponencial, `wheelMultiplier` 0,9), sincronizado com o ScrollTrigger pelo `gsap.ticker`. Diálogos e a paleta têm `data-lenis-prevent` para a página por trás não rolar. Ao trocar de rota, a página volta ao topo.
- **Progresso de leitura**: fio de 2px no topo (ScrollTrigger com `scrub`), visível só em páginas que rolam; recalculado por `ResizeObserver` quando a altura muda.
- **Linha do tempo do painel** (uma vez por sessão, ~1s): cartão da meta (opacidade) → máscara que revela a barra de segmentos (`clip-path`) → segmentos mudam de cor → números contam (MRR, leads, clientes) → barras do funil crescem → cartões sobem. O conteúdo fica invisível (`visibility`) só entre a montagem e o início da linha do tempo, sem piscar.
- **Linha do tempo do login**: título sobe por máscara de linha (`SplitText`), pontos entram em sequência, formulário aparece.
- **Entrada por rolagem** (`useScrollReveal`): grades de Ideias, Scripts e Base; 12px, 0,35s, stagger de 0,04s, uma vez.

## Alternativas consideradas

- Animar tudo na montagem (cabeçalhos, tabelas, listas): descartado; é o padrão de "slop" que as skills pedem para sinalizar, e atrasa a leitura numa ferramenta de uso diário.
- Rolagem suave para qualquer dispositivo: descartado; no toque o scroll nativo é melhor e a inércia do Lenis conflita com ele.
- ScrollTrigger com pin e horizontal-pan: fora do escopo de um CRM (sem seções de narrativa); a skill reserva esses padrões para páginas de apresentação.
- Skeleton em CSS puro sem atraso: piscaria em respostas rápidas.

## Consequências

- Novas dependências: `gsap` 3.15.0 (inclui `ScrollTrigger` e `SplitText`, gratuitos desde a 3.13; conferir a licença vigente antes de produção) e `lenis` 1.3.26, ambas fixadas.
- Toda tela nova precisa de um esqueleto em `components/skeletons.tsx` e da entrada em `RouteSkeleton`; tabelas novas declaram suas colunas em `lib/columns.ts`.
- `src/lib/consistency.test.ts` passou a verificar que GSAP e Lenis só entram por `src/motion`, que todo módulo de animação usa `MOTION_OK` e que não há `addEventListener('scroll')`.
- Limite conhecido: o painel integrado do app roda a página como aba em segundo plano e limita os quadros de animação; por isso a suavidade (60 fps) dos movimentos não pôde ser avaliada ali, só os estados inicial e final, o progresso e a limpeza.

## Verificação

Typecheck, 41 testes e build passando; contêiner `web` reconstruído. No navegador integrado: esqueleto de Clientes, Financeiro, Planejamento, Scripts, Leads, Estúdio e Painel conferidos com carregamento atrasado de propósito; geometria idêntica antes e depois dos dados em Clientes; Lenis ativo (`html.lenis`); barra de progresso de 0 a 1 ao rolar Planejamento; entrada por rolagem escondeu só o cartão abaixo da primeira tela em Scripts e o liberou ao rolar; linha do tempo do painel aplicou os estados iniciais e terminou no estado final; login com título dividido em máscaras de linha.
