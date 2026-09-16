import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "~/worker/db";
import {
	archiveCompany,
	createCompany,
	getCompany,
	listCompanies,
	purgeCompany,
	restoreCompany,
	updateCompany,
} from "~/worker/services/companies.service";
import { seedUser, testDb, testEnv } from "./helpers";

const LIST = {
	archived: false,
	direction: "desc" as const,
	take: 50,
};

describe("empresas no D1", () => {
	let db: Db;

	beforeEach(() => {
		db = testDb();
	});

	it("grava a coluna sombra ao criar", async () => {
		const created = await createCompany(db, {
			name: "Construções Açaí",
			source: "MANUAL",
		});

		const row = await db.company.findUniqueOrThrow({
			where: { id: created.id },
			select: { nameSearch: true },
		});

		expect(row.nameSearch).toBe("construcoes acai");
	});

	it("acha a empresa buscando sem acento", async () => {
		await createCompany(db, { name: "Padaria São José", source: "MANUAL" });

		const found = await listCompanies(db, { ...LIST, search: "sao jose" });

		expect(found.rows).toHaveLength(1);
		expect(found.rows[0]?.name).toBe("Padaria São José");
	});

	it("acha a empresa buscando com acento", async () => {
		await createCompany(db, { name: "Padaria São José", source: "MANUAL" });

		const found = await listCompanies(db, { ...LIST, search: "SÃO JOSÉ" });

		expect(found.rows).toHaveLength(1);
	});

	it("normaliza o domínio e recusa duplicata ativa", async () => {
		await createCompany(db, {
			name: "Alfa",
			domain: "https://www.alfa.com.br/precos",
			source: "MANUAL",
		});

		const stored = await listCompanies(db, LIST);
		expect(stored.rows[0]?.domain).toBe("alfa.com.br");

		await expect(
			createCompany(db, { name: "Alfa Duplicada", domain: "alfa.com.br", source: "MANUAL" }),
		).rejects.toThrow(/já pertence/);
	});

	it("arquivar libera o domínio para outra empresa", async () => {
		const first = await createCompany(db, {
			name: "Beta",
			domain: "beta.com.br",
			source: "MANUAL",
		});

		await archiveCompany(db, first.id, first.version);

		const second = await createCompany(db, {
			name: "Beta Nova",
			domain: "beta.com.br",
			source: "MANUAL",
		});

		expect(second.domain).toBe("beta.com.br");

		const reread = await getCompany(db, first.id);
		await expect(restoreCompany(db, first.id, reread.version)).rejects.toThrow(
			/já pertence/,
		);
	});

	it("a versão sobe a cada escrita", async () => {
		const created = await createCompany(db, { name: "Gama", source: "MANUAL" });
		expect(created.version).toBe(0);

		const once = await updateCompany(db, created.id, 0, { city: "Recife" });
		expect(once.version).toBe(1);

		const twice = await updateCompany(db, created.id, 1, { city: "Olinda" });
		expect(twice.version).toBe(2);
		expect(twice.city).toBe("Olinda");
	});

	it("recusa a escrita com versão velha", async () => {
		const created = await createCompany(db, { name: "Delta", source: "MANUAL" });

		await updateCompany(db, created.id, 0, { city: "Recife" });

		await expect(
			updateCompany(db, created.id, 0, { city: "Fortaleza" }),
		).rejects.toThrow(/mudou enquanto você editava/);
	});

	it("a busca separa arquivadas de ativas", async () => {
		const created = await createCompany(db, {
			name: "Epsilon",
			source: "MANUAL",
		});

		await archiveCompany(db, created.id, created.version);

		const active = await listCompanies(db, LIST);
		const archived = await listCompanies(db, { ...LIST, archived: true });

		expect(active.rows).toHaveLength(0);
		expect(archived.rows).toHaveLength(1);
		expect(archived.facetCounts).toEqual({ active: 0, archived: 1 });
	});

	it("purgar apaga a empresa, os negócios e solta os contatos", async () => {
		const ownerId = await seedUser(db);

		const company = await createCompany(db, {
			name: "Zeta",
			domain: "zeta.com.br",
			source: "MANUAL",
		});

		const contact = await db.contact.create({
			data: {
				firstName: "Maria",
				nameSearch: "maria",
				companyId: company.id,
				updatedAt: new Date(),
			},
			select: { id: true },
		});

		await db.deal.create({
			data: {
				name: "Painel Centro",
				nameSearch: "painel centro",
				companyId: company.id,
				ownerId,
				updatedAt: new Date(),
			},
		});

		await purgeCompany(db, testEnv().DB, company.id);

		expect(await db.company.count()).toBe(0);
		expect(await db.deal.count()).toBe(0);

		const survivor = await db.contact.findUniqueOrThrow({
			where: { id: contact.id },
			select: { companyId: true },
		});

		expect(survivor.companyId).toBeNull();
	});
});
