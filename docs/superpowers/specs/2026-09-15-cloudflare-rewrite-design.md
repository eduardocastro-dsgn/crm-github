# CRM nativo em Cloudflare — especificação

Data: 2026-09-15
Estado: aprovado para plano de implementação
Substitui: a arquitetura Vercel descrita em `docs/setup.md` e `docs/api.md`

## 1. Objetivo

O CRM roda inteiramente na infraestrutura Cloudflare. O acesso é por email e
senha. A primeira versão entrega o núcleo do CRM.

## 2. Decisões tomadas

| Decisão | Escolha |
| --- | --- |
| API | Reescrita nativa em Hono + tRPC sobre Workers |
| Banco | Cloudflare D1 |
| Frontend | SPA nova em Vite + React 19 |
| Agente `eve` | Sai do produto |
| Login | better-auth, só email e senha |
| Escopo v1 | Núcleo do CRM |
| Dados | O D1 começa vazio |

## 3. Arquitetura alvo

Um Worker serve tudo.

```
Cloudflare Worker "crm"
├── Assets binding  →  SPA em  /
├── Hono            →  /api/trpc/*  e  /api/auth/*
├── D1    "DB"      →  SQLite
├── KV    "CACHE"   →  cache e rate limit
├── R2    "MEDIA"   →  logos e imagens
└── Cron Trigger    →  câmbio diário e poda do arquivo
```

O SPA e a API ficam na mesma origem. O cookie de sessão é first-party.
O projeto não tem CORS, nem `crossSubDomainCookies`, nem `AUTH_COOKIE_DOMAIN`.
`AUTH_COOKIE_PREFIX` continua `crm`.

## 4. Estrutura do monorepo

| Caminho | Ação |
| --- | --- |
| `apps/worker` | Novo. Hono, tRPC, better-auth, `wrangler.jsonc` |
| `apps/web` | Novo. Vite, React 19, React Router, TanStack Query |
| `apps/app` | Removido. As telas migram para `apps/web` |
| `apps/api` | Removido. Os módulos viram routers tRPC |
| `apps/agent` | Removido. Arquivado na branch `archive/agent` |
| `packages/ui` | Mantido. 72 componentes, 2 tocam o Next |
| `packages/db` | Prisma `sqlite` + `@prisma/adapter-d1`, cliente por request |
| `packages/auth` | better-auth email e senha, fábrica por request |
| `packages/validation` | Cresce. Recebe 23 enums e 24 campos Json |
| `packages/env` | Lê o `Env` do Worker, não `process.env` |
| `packages/telemetry` | PostHog por `fetch`. `posthog-node` sai |

`packages/ui` perde duas dependências do Next:

- `entity-logo.tsx` troca `next/image` por `<img>` com `srcset`.
- `sonner.tsx` troca `next-themes` por um `ThemeProvider` próprio em `@crm/ui`.

`packages/ui` importa `@crm/db/images`. Isso viola a regra de cliente e servidor do
`AGENTS.md`. `isOptimizable` move para `@crm/validation`.

## 5. Bindings e configuração

`apps/worker/wrangler.jsonc` declara as bindings. `.dev.vars` guarda os segredos
locais. `wrangler secret put` guarda os de produção.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `DB` | D1 | Banco |
| `CACHE` | KV | Cache de valor e rate limit do better-auth |
| `MEDIA` | R2 | Logos, fotos e anexos |
| `BETTER_AUTH_SECRET` | secret | Assina o cookie |
| `ALLOWED_SIGN_IN` | var | Portão de cadastro |
| `RESEND_API_KEY` | secret opcional | Email de reset de senha |
| `POSTHOG_KEY` | secret opcional | Telemetria |

`DATABASE_URL` deixa de existir. `API_URL` e `APP_URL` deixam de existir: a origem
é uma só. O `.env.example` da raiz documenta o que sobra, e ganha uma seção que
aponta para `wrangler.jsonc`. O `globalPassThroughEnv` do `turbo.json` perde as
variáveis mortas.

## 6. Nada de singleton

As bindings só existem dentro do request. Instância de módulo para de funcionar.

```ts
// packages/db/src/client.ts
export function createDb(env: Env) {
  return new PrismaClient({ adapter: new PrismaD1(env.DB) });
}
```

```ts
// apps/worker/src/context.ts
export type Ctx = { db: Db; auth: Auth; session: Session | null };

app.use(async (c, next) => {
  const db = createDb(c.env);
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});
```

Toda função de domínio recebe `db` como primeiro argumento. Nenhum módulo importa
uma instância. Esta regra vale para o repositório inteiro.

## 7. O banco no D1

### 7.1 Conversões obrigatórias

| Hoje | No D1 | Onde a regra vive |
| --- | --- | --- |
| 23 `enum` | `String` | Um `z.enum` por enum em `packages/validation` |
| 24 `Json` | `String` | Um schema Zod por forma, parse na leitura |
| 6 `Decimal` | `Int` | Tipo de marca `Cents` em `packages/db/src/currency.ts` |

O Prisma não aceita `enum` nem `Json` com `provider = "sqlite"`. Cada enum vira um
`z.enum` exportado por subpath. Cada campo Json vira um módulo em
`packages/validation/src`, com `parse` que lança erro real. O padrão existente é
`packages/validation/src/agent-manifest.ts`.

`Decimal` vira inteiro:

- `amount` e `baseAmount` viram `Int`, em centavos, tipo `Cents`.
- `fxRate` e `ExchangeRate.rate` viram `Int`, escalado por 10^10, tipo `ScaledRate`.
- `costUsd` sai do schema junto com o agente.
- `CustomField.number` vira `Real`.

`docs/currency.md` recebe a nova escala. A regra continua: só `baseAmount` é somado.

### 7.2 Migrações

O Prisma 7 não migra o D1. O fluxo é `prisma migrate diff` mais `wrangler d1
migrations`.

```sh
bun run db:diff      # prisma migrate diff → migrations/NNNN_nome.sql
wrangler d1 migrations apply crm --local
wrangler d1 migrations apply crm --remote
```

O `prisma migrate deploy` sai dos scripts. O `packages/db/scripts/require-local-db.ts`
passa a checar `--local` contra `--remote`.

### 7.3 O D1 não tem transação

O D1 não tem transação interativa. O Prisma não oferece `$transaction` no D1.
O repositório tem 66 chamadas. Depois do corte do agente restam **14** no núcleo:
`workspace` 1, `activity-stamp` 2, `deals` 2, `contacts` 3, `companies` 2, `fields` 2,
`packages/auth/organization` 1, `packages/telemetry/install` 1.

Cada uma recebe um dos três desenhos:

1. **`db.batch()`** quando são escritas em sequência sem leitura no meio.
   Cobre a maioria, incluindo `activity-stamp` e `fields`.
2. **Escrita idempotente** quando o passo pode repetir sem dano. Cobre
   `contacts.purge` mais a supressão, e `deals.attachContact`.
3. **Trava otimista por versão** quando a decisão depende de uma leitura. Cada
   tabela envolvida ganha `version Int @default(0)`, e a escrita usa
   `updateMany({ where: { id, version }, data: { version: { increment: 1 } } })`.
   Uma contagem zero significa conflito e o procedimento repete uma vez.
   Cobre `workspace.changeRole`, que hoje usa `FOR UPDATE` para proteger a regra
   do último dono.

Nenhum serviço fica sem um destes três. A escolha é escrita no plano de
implementação, serviço a serviço.

### 7.4 `FOR UPDATE` e SQL cru saem

O SQLite não trava linha. Seis arquivos do núcleo usam `FOR UPDATE`:
`contacts`, `workspace`, `deals`, `companies`, `packages/telemetry/install` e
`packages/db/idempotency`. Cada um passa para a trava otimista por versão.

O repositório tem 38 chamadas de `$queryRaw` e `$executeRaw`. A sintaxe é
Postgres. Cada uma é reescrita em Prisma normal, ou em SQL do SQLite quando o
Prisma não expressa a consulta. Nenhuma sobrevive sem revisão.

### 7.5 Busca sem acento e sem `mode: "insensitive"`

O Prisma recusa `mode: "insensitive"` com `provider = "sqlite"`. O repositório usa
esse argumento em 11 arquivos. O `LIKE` do SQLite ignora maiúsculas só em ASCII,
então `José` e `jose` deixam de casar. Um CRM em português não aceita isso.

A solução é uma coluna sombra por campo pesquisável:

- `Company.nameSearch`, `Company.domainSearch`, `Contact.nameSearch`,
  `Contact.emailSearch`, `Deal.nameSearch`.
- Uma função `searchKey(value)` em `packages/validation` põe em minúsculas e tira
  acento com `normalize("NFD")`.
- Todo escritor grava a sombra na mesma instrução que grava o campo. A regra é a
  mesma de `baseAmount` e `baseCurrency` em `docs/currency.md`.
- A busca usa `contains` na sombra, sem `mode`.

`SearchService.quick` passa a ler as sombras.

### 7.6 Limites

O D1 guarda 10 GB por base. Binário vai para o R2, nunca para o D1. A poda do
arquivo continua, por Cron Trigger, lendo `AppSetting.archiveRetentionDays`.

## 8. Login

`packages/auth/src/auth.ts` vira `createAuth(env, db)`.

```ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 12,
  requireEmailVerification: false,
  sendResetPassword: sendResetPasswordIfConfigured(env),
},
```

- `prismaAdapter(db, { provider: "sqlite" })`.
- Plugin `organization` mantido. O workspace singleton continua, com id
  `WORKSPACE_ID`. Nenhuma função recebe `organizationId`.
- `ensureWorkspaceMembership` continua em `databaseHooks.session.create.before`, e
  continua degradando em vez de lançar.
- Plugin `apiKey` removido da v1. Nenhuma integração o consome depois do corte.
- `sso`, `genericOAuth`, `socialProviders` e `slack*` removidos.
- `rateLimit.storage` passa de `database` para `secondaryStorage` sobre KV.
- `ALLOWED_SIGN_IN` continua decidindo quem ganha conta, em
  `databaseHooks.user.create.before`. Uma lista vazia continua fechando a porta.
  Com email e senha esse é o único portão, então a lista é obrigatória.

### 8.1 Telas

`apps/web` ganha quatro rotas públicas. Todas usam componentes de `@crm/ui`, sem
`className` de correção.

| Rota | O que faz |
| --- | --- |
| `/sign-in` | Email e senha. Erro genérico, nunca diz se o email existe |
| `/sign-up` | Email, senha, confirmação. Recusa fora de `ALLOWED_SIGN_IN` |
| `/forgot-password` | Pede email. Resposta igual para email conhecido e desconhecido |
| `/reset-password` | Consome o token e grava a senha nova |

O primeiro cadastro é o dono do workspace. Os seguintes entram como membros.

### 8.2 Email opcional

`RESEND_API_KEY` ausente remove a recuperação de senha. Nada lança. A tela
`/forgot-password` informa que o administrador precisa redefinir. O padrão é
`apps/agent/agent/lib/capabilities.ts`, que migra para
`apps/worker/src/capabilities.ts`.

## 9. A API

`apps/worker/src/routers/*.router.ts`, um por área. O router é fino: Zod entra,
serviço sai. O Prisma vive no serviço. Esta regra vem de `docs/api.md` e não muda.

```ts
export const dealsRouter = router({
  list: protectedProcedure.input(listInput).query(({ ctx, input }) =>
    listDeals(ctx.db, input),
  ),
});
```

- `protectedProcedure` resolve a sessão. Um procedimento sem ele é público, e não
  existe outro guarda.
- Filtro, ordenação e paginação acontecem no Prisma. `resolveOrderBy` continua.
- Lista devolve `{ rows, total, facetCounts }`.
- `src/generated/server.ts` deixa de existir. O tRPC nativo infere o tipo, então o
  passo de geração some junto com o `nestjs-trpc`.
- O OpenAPI sai da v1.

Áreas na v1: `auth`, `workspace`, `companies`, `contacts`, `deals`, `activities`,
`fields`, `saved-views`, `search`, `settings`, `currency`, `dashboard`, `archive`.
O `dashboard` entra inteiro: eu verifiquei que ele não lê nada do agente.

Áreas que saem: `agent`, `enrichment`, `google`, `microsoft`, `mailbox`, `sync`,
`slack`, `sso`, `tracking`, `conversations`, `backfill`, `api-keys`.

## 10. O frontend

`apps/web`, Vite 7, React 19, React Router 7 em modo declarativo.

- O cliente tRPC e o TanStack Query continuam iguais aos de hoje.
- `nuqs` troca o adaptador do Next pelo de React Router.
- As 110 telas `"use client"` de `apps/app` portam por remoção da diretiva e troca
  de `next/navigation` por `react-router`.
- As 28 rotas do App Router viram rotas do React Router. O que hoje é server
  component vira `loader` ou uma query do TanStack.
- A regra do `AGENTS.md` sobre cliente e servidor continua valendo de outra forma:
  nenhum arquivo de `apps/web` importa `@crm/db` ou `@crm/auth`. O tipo do router
  entra por `import type`.
- O `proxy.ts` do Next sai. Os portões viram um componente de rota que lê a sessão
  uma vez e redireciona.
- O slug do workspace continua na URL, resolvido no cliente pelo `workspace.get`.

## 11. Erros

- Todo Json do banco passa por Zod. Falha de parse vira erro, nunca array vazio.
- O `errorFormatter` do tRPC achata o erro do Zod.
- Os serviços lançam `TRPCError`. O mapa `HttpException` do Nest sai.
- O código do Prisma `P2025` vira `NOT_FOUND` num único tradutor,
  `apps/worker/src/errors.ts`.
- O log usa o `console` do Worker, com um objeto por linha. Nunca cabeçalho, nunca
  corpo, nunca query string. A regra de `docs/api.md` continua.

## 12. Testes

- `@cloudflare/vitest-pool-workers` roda o Worker com D1 real via Miniflare.
- Cada serviço tem teste de integração contra D1, não contra mock.
- Os três desenhos de escrita da seção 7.3 têm teste de concorrência.
- A conversão de dinheiro tem teste de propriedade sobre escala e câmbio.
- `bun test` continua nos pacotes puros: `validation`, `env`, `ui`.

## 13. Ordem de entrega

| Fase | Entrega | Prova |
| --- | --- | --- |
| 1 | Worker, D1, schema convertido, migrações | `wrangler dev` responde e migra |
| 2 | better-auth email e senha, quatro telas | Você cria conta e entra |
| 3 | SPA com shell, rotas, `@crm/ui`, portões | Navegação com sessão |
| 4 | Empresas e Contatos ponta a ponta | CRUD real em D1, com teste |
| 5 | Negócios, Atividades, campos, busca, views | Núcleo completo |
| 6 | Cron de câmbio, R2, KV, poda do arquivo | Paridade do núcleo |

## 14. Fora do escopo

Agente `eve`, enriquecimento, Gmail, Calendar, Outlook, Slack, SSO, script de
tracking, conversas, OpenAPI, migração de dados.

## 15. Riscos aceitos

1. O D1 não tem transação. Catorze pontos do núcleo trocam atomicidade por um
   dos três desenhos da seção 7.3.
2. O D1 limita a base em 10 GB. Binário vai para o R2. Evento antigo vai para a poda.
3. `Decimal` vira inteiro. Um erro de escala corrompe valor de negócio.
4. Sem `RESEND_API_KEY` ninguém recupera a senha sozinho.
5. O produto perde o agente e as integrações de email.
6. A busca depende de coluna sombra. Um escritor que esquece a sombra some da busca.
7. As 38 consultas cruas em Postgres são reescritas à mão. Cada uma pode mudar de
   resultado sem que o tipo mude.
