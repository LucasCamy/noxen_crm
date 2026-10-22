# ADR-0001: Reconstruir o CRM como aplicação com banco de dados

- Status: Aceita
- Data do registro: 2026-10-22
- Responsáveis: Lucas Camy
- Referências: [CRM original](https://github.com/gabrielspares159-cell/noxencrm) (clonado em `reference/noxencrm-original`)

## Contexto

O CRM original é um workspace de arquivos: carteira, leads, financeiro e fichas de clientes em Markdown, scripts Python que geram uma página HTML estática ("Central") e um Claude atuando como "Diretor Noxen". Não há autenticação, banco de dados nem API. Edições feitas na Central publicada ficam em um banco de artifact e só chegam aos arquivos quando alguém pede "consolidar central"; não existe sincronização automática, controle de acesso, histórico confiável nem concorrência. O repositório é público e os dados reais ficam fora dele, em backup `tar.gz`.

## Decisão

Reescrever o produto como aplicação com API, banco relacional, autenticação e interface web, usando o original apenas como referência de domínio (entidades, etapas do funil, regras de MRR e meta). Os dados passam a viver no banco, com migração futura dos arquivos `.md` por um importador próprio. O projeto original permanece em `reference/` somente leitura.

## Alternativas consideradas

- Evoluir o original no lugar (adicionar login e banco ao gerador Python e à Central HTML): descartada porque a Central é um único HTML de ~170 KB gerado, sem separação entre dados, regras e interface.
- Manter arquivos como fonte de verdade e só adicionar autenticação: descartada por não resolver concorrência, histórico nem integrações (fila, cache, API).

## Consequências

- Positivas: dados consistentes e auditáveis, múltiplos usuários com papéis, API reutilizável pelo frontend e por integrações, base para fila e cache.
- Negativas: reescrita grande; é preciso reproduzir gradualmente as nove seções da Central ([roadmap](../roadmap.md)) e migrar dados existentes; o fluxo com o Diretor Noxen (Claude lendo arquivos) deverá ser reavaliado depois.
