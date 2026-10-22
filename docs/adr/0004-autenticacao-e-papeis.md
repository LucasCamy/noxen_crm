# ADR-0004: Identity + JWT curto + refresh rotativo; três papéis; um único tenant

- Status: Proposta (implementada)
- Data do registro: 2026-10-22
- Referências: escolha de "só a Noxen, com usuários e papéis" confirmada pelo responsável

## Contexto

O original não tem autenticação. A Noxen é uma única agência com poucas pessoas que fazem coisas diferentes (comercial, marketing, administração). A interface será uma SPA.

## Decisão

- ASP.NET Core Identity (usuários e papéis no PostgreSQL), senha mínima de 10 caracteres com maiúscula, minúscula e dígito, bloqueio por 15 min após 5 falhas.
- Access token JWT HS256 de 15 min (claims `sub`, `email`, `name`, `role`) + refresh token opaco de 7 dias, guardado só como hash SHA-256, rotacionado a cada uso. O reuso de um refresh token já rotacionado revoga todas as sessões do usuário. Desativar um usuário revoga seus refresh tokens.
- Papéis: `Admin` (tudo, gestão de usuários), `Comercial` (escreve leads e clientes), `Marketing` (leitura). Política padrão: usuário autenticado; rotas públicas são marcadas explicitamente.
- Login e refresh têm limite por IP (10/min, configurável).
- Um único tenant. Não há `TenantId` nas tabelas.
- Sem senha padrão: o primeiro Admin vem de `AdminSeed__*`.

## Alternativas consideradas

- Cookie de sessão httpOnly em vez de JWT na SPA: ficou fora por ora; o frontend ainda não existe e a API pode ser consumida por outros clientes. Revisitar quando o frontend for definido (armazenamento do token no navegador é o principal risco).
- Provedor externo (Keycloak, Entra ID): excesso para o tamanho atual.
- Multi-tenant desde já: descartado pelo responsável para o escopo atual.

## Consequências

- Na SPA (implementada): o access token fica só em memória e o refresh token no `localStorage`, o que o expõe a XSS. Há renovação automática serializada (uma chamada por vez) para não disparar a detecção de reuso. Migrar para cookie httpOnly (com SameSite e proteção contra CSRF) exige mudança na API e deve ser decidido antes de produção.
- Tokens de acesso continuam válidos até expirar (até 15 min) mesmo após desativar o usuário.
- A chave HMAC (`Jwt__Key`) é um segredo que precisa ser gerenciado e rotacionado fora do repositório.
- Tornar a aplicação multi-tenant depois exige coluna de tenant, filtros globais e migração de dados (nova ADR).
- O limite de taxa é em memória por instância; com várias instâncias da API ele não é compartilhado.
