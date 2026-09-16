import { env } from "cloudflare:test";
import type { Db } from "~/worker/db";
import { createDb } from "~/worker/db";
import type { Env } from "~/worker/env";

export function testEnv(): Env {
	return env as unknown as Env;
}

export function testDb(): Db {
	return createDb(testEnv());
}

export async function seedUser(db: Db, email = "ana@exemplo.com.br") {
	const id = crypto.randomUUID();

	await db.user.create({
		data: {
			id,
			name: "Ana Souza",
			email,
			emailVerified: true,
			updatedAt: new Date(),
		},
	});

	return id;
}
