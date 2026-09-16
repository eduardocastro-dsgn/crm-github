import { parseAllowList } from "~/shared/workspace";

export interface Env {
	DB: D1Database;
	CACHE: KVNamespace;
	MEDIA: R2Bucket;
	ASSETS: Fetcher;

	BETTER_AUTH_SECRET: string;
	ALLOWED_SIGN_IN: string;

	REPORTING_CURRENCY?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM?: string;
	POSTHOG_KEY?: string;
}

export function requireSecret(env: Env): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();

	if (!secret || secret.length < 32) {
		throw new Error(
			"BETTER_AUTH_SECRET ausente ou curto. Gere com: openssl rand -base64 32",
		);
	}

	return secret;
}

export function allowList(env: Env): string[] {
	return parseAllowList(env.ALLOWED_SIGN_IN);
}

export function reportingCurrency(env: Env): string {
	return env.REPORTING_CURRENCY?.trim() || "BRL";
}
