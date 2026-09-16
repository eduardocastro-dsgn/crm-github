import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins/organization";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { isWorkspaceEmail } from "~/shared/workspace";
import { capabilities } from "./capabilities";
import type { Db } from "./db";
import { allowList, type Env, requireSecret } from "./env";
import { sendMail } from "./email";
import { ensureWorkspaceMembership } from "./workspace-membership";

export const AUTH_COOKIE_PREFIX = "crm";

export const AUTH_BASE_PATH = "/api/auth";

export const MIN_PASSWORD_LENGTH = 12;

const SESSION_DAYS = 7;

const KV_MIN_TTL_SECONDS = 60;

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(env: Env, db: Db, origin: string) {
	const allowed = allowList(env);
	const canResetPassword = capabilities(env).passwordReset;

	return betterAuth({
		appName: "CRM",
		baseURL: origin,
		basePath: AUTH_BASE_PATH,
		secret: requireSecret(env),

		database: {
			db: new Kysely({ dialect: new D1Dialect({ database: env.DB }) }),
			type: "sqlite",
		},

		secondaryStorage: {
			get: (key) => env.CACHE.get(key),
			set: (key, value, ttl) =>
				env.CACHE.put(key, value, {
					expirationTtl: Math.max(KV_MIN_TTL_SECONDS, ttl ?? KV_MIN_TTL_SECONDS),
				}).then(() => undefined),
			delete: (key) => env.CACHE.delete(key),
		},

		emailAndPassword: {
			enabled: true,
			minPasswordLength: MIN_PASSWORD_LENGTH,
			autoSignIn: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url }) => {
				await sendMail(env, {
					to: user.email,
					subject: "Redefinir a senha do CRM",
					text: `Abra este endereço para escolher uma senha nova:\n\n${url}\n\nO link vale por uma hora. Se você não pediu, ignore esta mensagem.`,
				});
			},
		},

		socialProviders: {},

		session: {
			expiresIn: 60 * 60 * 24 * SESSION_DAYS,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: true, maxAge: 5 * 60 },
		},

		rateLimit: {
			enabled: true,
			storage: "secondary-storage",
		},

		advanced: {
			cookiePrefix: AUTH_COOKIE_PREFIX,
			useSecureCookies: origin.startsWith("https://"),
		},

		trustedOrigins: [origin],

		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						if (!isWorkspaceEmail(user.email, allowed)) {
							throw new APIError("FORBIDDEN", {
								message:
									"Este endereço não tem permissão para criar conta neste CRM.",
							});
						}

						return { data: user };
					},
				},
			},
			session: {
				create: {
					before: async (session) => {
						await ensureWorkspaceMembership(db, session.userId);
						return { data: session };
					},
				},
			},
		},

		plugins: [
			organization({
				organizationLimit: 1,
				creatorRole: "owner",
				allowUserToCreateOrganization: false,
			}),
		],

		onAPIError: {
			onError: (error) => {
				console.log({
					message: "Erro na autenticação",
					kind: error instanceof APIError ? error.status : "desconhecido",
					resetAvailable: canResetPassword,
				});
			},
		},
	});
}
