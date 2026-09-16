import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { AUTH_BASE_PATH, createAuth } from "./auth";
import { createDb, type Db } from "./db";
import type { Env } from "./env";
import { appRouter } from "./routers";
import { refreshRates } from "./services/rates.service";
import { pruneArchive } from "./services/prune.service";
import { memberRole } from "./services/workspace.service";
import type { Context as TrpcContext } from "./trpc";

type Vars = { db: Db };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", async (c, next) => {
	c.set("db", createDb(c.env));
	await next();
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => {
	const auth = createAuth(c.env, c.get("db"), new URL(c.req.url).origin);
	return auth.handler(c.req.raw);
});

app.use(
	"/api/trpc/*",
	trpcServer({
		router: appRouter,
		endpoint: "/api/trpc",
		createContext: async (_opts, c): Promise<TrpcContext> => {
			const db = c.get("db") as Db;
			const env = c.env as Env;
			const auth = createAuth(env, db, new URL(c.req.url).origin);

			const session = await auth.api.getSession({
				headers: c.req.raw.headers,
			});

			if (!session) return { db, env, user: null, role: null };

			return {
				db,
				env,
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image ?? null,
				},
				role: await memberRole(db, session.user.id),
			};
		},
		onError: ({ error, path }) => {
			console.log({
				message: "Erro no tRPC",
				path,
				code: error.code,
			});
		},
	}),
);

app.notFound((c) => c.json({ error: "Rota não existe." }, 404));

export default {
	fetch: app.fetch,

	async scheduled(_event: ScheduledController, env: Env): Promise<void> {
		const db = createDb(env);

		await Promise.allSettled([refreshRates(db, env), pruneArchive(db, env.DB)]);
	},
} satisfies ExportedHandler<Env>;
