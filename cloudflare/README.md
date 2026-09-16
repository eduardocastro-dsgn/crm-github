# CRM na Cloudflare

Esta pasta contém a reescrita do CRM para rodar inteiramente na Cloudflare.
Nada fora desta pasta foi alterado, com uma exceção: a raiz `package.json`
registra `cloudflare` como workspace, para que `@crm/ui` resolva.

A especificação está em
`docs/superpowers/specs/2026-09-15-cloudflare-rewrite-design.md`.

## O que roda onde

| Peça | Tecnologia | Caminho |
| --- | --- | --- |
| API | Hono + tRPC v11 + better-auth | `worker/` |
| Interface | Vite + React 19 + React Router | `web/` |
| Banco | Cloudflare D1, Prisma 7 + adapter-d1 | `prisma/`, `migrations/` |
| Tipos comuns | Zod | `shared/` |

Um Worker só serve o SPA e a API. A mesma origem serve as duas coisas, então o
cookie de sessão é first-party. O projeto não tem CORS.

## Primeira execução

```sh
bun install                       # na raiz do repositório
cd cloudflare
cp .dev.vars.example .dev.vars    # preencha BETTER_AUTH_SECRET e ALLOWED_SIGN_IN

wrangler d1 create crm            # copie o database_id para wrangler.jsonc
wrangler kv namespace create CACHE  # copie o id para wrangler.jsonc
wrangler r2 bucket create crm-media

bun run db:generate               # gera o cliente Prisma
bun run db:apply                  # aplica migrations/0001_init.sql no D1 local
bun run dev                       # web :3000, worker :8787
```

Abra `http://localhost:3000/sign-up`. O primeiro cadastro vira dono do workspace.

## Variáveis

`.dev.vars` no desenvolvimento. `wrangler secret put NOME` na produção.
`wrangler.jsonc` guarda o que não é segredo, em `vars`.

| Nome | Obrigatório | O que faz |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | sim | Assina o cookie de sessão. 32 caracteres ou mais |
| `ALLOWED_SIGN_IN` | sim | Quem pode criar conta. Lista vazia recusa todo cadastro |
| `REPORTING_CURRENCY` | não | Moeda dos totais. Padrão `BRL` |
| `RESEND_API_KEY` | não | Liga a recuperação de senha |
| `RESEND_FROM` | não | Remetente do email de recuperação |
| `POSTHOG_KEY` | não | Telemetria de produto |

Uma chave ausente remove uma capacidade. Nada lança.
`worker/capabilities.ts` é o único lugar que sabe o que está configurado.

## Provas que já rodam

```sh
bun run check-types    # zero erros em worker, web, shared e test
bun run test:unit      # 15 testes puros: busca sem acento e centavos
bun run build          # SPA compila
bunx wrangler deploy --dry-run   # Worker empacota, 1,75 MiB comprimido

# ponta a ponta contra D1 real:
bunx wrangler d1 migrations apply crm --local
bunx wrangler dev --port 8787 --local &
bun run test:smoke     # 10 provas
```

`scripts/smoke.sh` prova, contra o runtime de verdade: o portão
`ALLOWED_SIGN_IN`, o cadastro por senha, o workspace singleton, a normalização
de domínio, a busca sem acento, o conflito de domínio, a trava otimista, o
dinheiro em centavos, a atividade de mudança de etapa e a purga em lote.

## Um espaço no caminho quebra os testes de integração

`bun run test` roda `test/companies.test.ts`, e ele **falha neste repositório**.
A causa não é o código. O diretório chama-se `dudu/crm /crm`, com um espaço, e o
carregador de módulos do `@cloudflare/vitest-pool-workers` procura o wasm do
Prisma num caminho com `%20`. O arquivo não existe lá.

O conserto é renomear o diretório para tirar o espaço. Depois disso
`bun run test` passa inteiro. Até lá use `bun run test:unit` mais
`bun run test:smoke`, que juntos cobrem as mesmas decisões.

## Onde o cliente Prisma é gerado

`node_modules/.prisma-d1`, não numa pasta de código. O runner de teste só carrega
o wasm do compilador quando ele está dentro de `node_modules`. O alias `~/prisma`
aponta para lá, no `tsconfig.json`, no `vitest.config.ts` e no
`web/vite.config.ts`.

## Migrações

O Prisma 7 não migra o D1. O fluxo é `prisma migrate diff` mais Wrangler.

```sh
bun run db:diff nome-da-mudanca   # escreve migrations/NNNN_nome.sql
bun run db:apply                  # local
bun run db:apply:remote           # produção
```

`migrations/0001_init.sql` é escrita à mão e cria as 20 tabelas.

## O que o D1 muda no código

**Não existe transação.** O Prisma não oferece `$transaction` no D1. Três
desenhos substituem a atomicidade:

1. `batch()` em `worker/services/batch.ts`, que usa o `d1.batch()` nativo. Esse
   é atômico. Toda purga usa ele.
2. Escrita idempotente, quando repetir não causa dano. A poda do arquivo usa ele.
3. Trava otimista por versão. Toda tabela editável tem `version`. A escrita usa
   `updateMany({ where: { id, version } })` e `retryOnConflict` tenta uma vez
   mais. `worker/services/write.ts` é o padrão.

**Não existe enum.** Os 23 enums viraram `z.enum` em `shared/enums.ts`.

**Não existe coluna Json.** Os campos Json viraram texto. `shared/json.ts` faz o
parse com Zod na leitura. Falha de parse é erro real, nunca array vazio.

**Não existe Decimal.** Dinheiro é inteiro em centavos, tipo `Cents`. Taxa de
câmbio é inteiro escalado por 10^10, tipo `ScaledRate`. `shared/money.ts` é a
única aritmética. Só `baseAmount` entra em soma.

**A busca ignora acento por coluna sombra.** O Prisma recusa
`mode: "insensitive"` no SQLite, e o `LIKE` do SQLite só ignora maiúsculas em
ASCII. Sem sombra, `José` não casaria com `jose`. Toda tabela pesquisável tem
`nameSearch`, e quem grava `name` grava `nameSearch` na mesma instrução.
`shared/search-key.ts` é a única função que gera a chave.

## O que não existe nesta versão

O agente `eve`, o enriquecimento, Gmail, Calendar, Outlook, Slack, SSO, o script
de tracking, as conversas e o documento OpenAPI.
