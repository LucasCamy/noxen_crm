# ADR-0009: Ficha completa do cliente (contrato, perfil, acessos) e anotações no histórico do lead

- Status: Proposta (implementada)
- Data do registro: 2026-10-23

## Contexto

A comparação com o CRM original ([paridade](../paridade-com-o-original.md)) mostrou que a ficha do cliente (`perfil.md`, `financeiro.md`, `acessos.md`) tinha muito mais campos do que o cadastro daqui, e que o histórico do lead no original aceitava anotações livres, não só mudanças de etapa.

## Decisão

- **Contrato e contato no próprio `Client`** (colunas novas: e-mail do contato, serviços contratados, forma de pagamento, início e fim do contrato, reajuste). São dados comerciais editados pela mesma tela e pela mesma política (`CanWriteCrm`) e com o mesmo controle de edição simultânea (`Version`/`xmin`) do cadastro. Um método de domínio separado (`UpdateContract`) valida e-mail e datas.
- **Perfil de negócio e marketing em `ClientProfile`** (1:1, chave = `ClientId`, versão própria): site, Instagram, Facebook, TikTok, o que vende, cliente ideal, diferenciais, concorrentes, sazonalidade, objetivo, necessidades, tom de voz, pilares, o que funcionou e verba de anúncios. Muda em outro ritmo e é escrito por quem cuida do marketing (`CanWriteMarketing`: Admin, Comercial e Marketing). `GET` devolve uma ficha vazia (versão 0) quando não existe; o primeiro `PUT` com versão 0 a cria e as seguintes exigem a versão lida (409 em divergência). Endereços web são normalizados para http/https (esquemas como `javascript:` são recusados) e o Instagram guarda só o usuário.
- **Acessos em `ClientAccess`** (N por cliente): plataforma, conta, tipo, **onde está a senha**, data e observação. O sistema nunca recebe nem guarda senhas; a tela avisa e o campo é um lugar, não uma credencial.
- **Anotações do lead em `LeadNote`**: texto de até 2.000 caracteres, autor e data; imutáveis. Quem escreveu ou um Admin apaga. `GET /api/leads/{id}/timeline` junta mudanças de etapa e anotações em ordem de data; `GET /history` continua devolvendo só as etapas. Apagar o lead apaga as anotações (LGPD). Anotação não gera evento na outbox: não afeta painel nem cache.
- **Frontend**: a ficha do cliente ganhou abas (Visão geral, Perfil, Acessos, Pagamentos, Reuniões, Campanhas, Resultados, Entregas) e atalhos no cabeçalho (WhatsApp, Instagram, site, copiar e-mail); "Entregas" lista conteúdos, tarefas e projetos do cliente. O histórico do lead ganhou o campo de anotação (Ctrl + Enter salva).

## Alternativas consideradas

- Tudo em `Client`: engordaria a tabela mais lida (lista, painel, cobranças) e misturaria o ritmo de edição do contrato com o do marketing.
- Perfil como JSON: perderia validação, limites por campo e a possibilidade de buscar e filtrar depois.
- Guardar credenciais criptografadas: aumenta o risco e a responsabilidade (LGPD, vazamento) sem necessidade; o original já proibia senhas.
- Anotações editáveis: apagaria o valor de auditoria do histórico; apagar e reescrever mantém a regra simples.

## Consequências

- Uma migration aditiva (`Phase5ClientProfileAndLeadNotes`): colunas anuláveis em `clients` e três tabelas novas; nada é reescrito, então a aplicação anterior continua funcionando durante a implantação.
- O contrato de `ClientInput`/`ClientResponse` cresceu; os tipos do frontend (`types.ts`) foram atualizados à mão.
- Leitura do perfil e dos acessos é aberta a qualquer usuário autenticado (como reuniões e campanhas); o Marketing não vê o financeiro, e a forma de pagamento fica na ficha de contrato do cliente, já visível a ele (a mensalidade também é).

## Verificação

24 testes novos (domínio e API, PostgreSQL real), 108 no total: normalização e validação de URLs e Instagram, e-mail e datas do contrato, ficha vazia/primeira gravação/versão antiga/409, permissões por papel, CRUD de acessos, ordem da linha do tempo, quem pode apagar anotação e remoção em cascata. Conferido no contêiner pelo nginx: migration aplicada pelo serviço `migrate`, API de perfil e acessos, abas da ficha e anotação de lead pela interface.
