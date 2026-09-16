import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	cloudflareTest,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig, type Plugin } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

function toPath(value: string): string {
	if (value.startsWith("file://")) return fileURLToPath(value);

	return value.includes("%") ? decodeURIComponent(value) : value;
}

function externalWasm(): Plugin {
	return {
		name: "crm:external-wasm",
		enforce: "pre",
		resolveId(source, importer) {
			if (!source.includes(".wasm") || !importer) return null;

			const bare = toPath(source.split("?")[0] ?? source);

			if (!bare.startsWith(".")) return { id: bare, external: true };

			const dir = dirname(toPath(importer));

			return { id: resolve(dir, bare), external: true };
		},
	};
}

export default defineConfig({
	resolve: {
		alias: {
			"~/prisma": `${root}node_modules/.prisma-d1`,
			"~/shared": `${root}shared`,
			"~/worker": `${root}worker`,
		},
	},
	plugins: [
		externalWasm(),
		cloudflareTest(async () => ({
			miniflare: {
				compatibilityDate: "2026-08-22",
				compatibilityFlags: ["nodejs_compat"],
				d1Databases: { DB: "crm-test" },
				kvNamespaces: ["CACHE"],
				r2Buckets: ["MEDIA"],
				bindings: {
					TEST_MIGRATIONS: await readD1Migrations(`${root}migrations`),
					BETTER_AUTH_SECRET: "chave-de-teste-com-mais-de-32-caracteres",
					ALLOWED_SIGN_IN: "exemplo.com.br",
					REPORTING_CURRENCY: "BRL",
				},
			},
		})),
	],
	test: {
		setupFiles: ["./test/setup.ts"],
	},
});
