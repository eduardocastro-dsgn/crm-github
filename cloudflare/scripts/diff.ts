import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "migrations";
const SCHEMA = "prisma/schema.prisma";

const name = process.argv[2];

if (!name) {
	console.error("Uso: bun scripts/diff.ts <nome-da-migracao>");
	process.exit(1);
}

if (!existsSync(MIGRATIONS)) mkdirSync(MIGRATIONS);

const applied = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql"));
const next = String(applied.length + 1).padStart(4, "0");
const target = join(MIGRATIONS, `${next}_${name}.sql`);

const sql = execFileSync(
	"bunx",
	[
		"prisma",
		"migrate",
		"diff",
		"--from-local-d1",
		"--to-schema-datamodel",
		SCHEMA,
		"--script",
	],
	{ encoding: "utf8" },
);

if (sql.trim() === "" || sql.includes("-- This is an empty migration.")) {
	console.log("Nada mudou. Nenhuma migração escrita.");
	process.exit(0);
}

writeFileSync(target, sql);

console.log(`Escrito ${target}`);
console.log("Aplique com: bun run db:apply");
