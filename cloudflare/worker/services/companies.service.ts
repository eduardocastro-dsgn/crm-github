import { z } from "zod";
import type { ListInput, ListResult } from "~/shared/list";
import { recordSource } from "~/shared/enums";
import { optionalSearchKey, searchKey } from "~/shared/search-key";
import type { Db } from "../db";
import { conflict, notFound, translate } from "../errors";
import { batch, sql } from "./batch";
import {
	archivedFilter,
	blankToNull,
	cursorArgs,
	normalizeDomain,
	normalizeEmail,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "./list";
import { retryOnConflict } from "./write";

export const COMPANY_SORTS = [
	"name",
	"createdAt",
	"updatedAt",
	"lastActivityAt",
] as const;

export const companyInput = z.object({
	name: z.string().trim().min(1).max(200),
	domain: z.string().trim().max(255).optional(),
	website: z.string().trim().max(2000).optional(),
	description: z.string().trim().max(5000).optional(),
	industry: z.string().trim().max(120).optional(),
	city: z.string().trim().max(120).optional(),
	country: z.string().trim().max(120).optional(),
	phone: z.string().trim().max(60).optional(),
	email: z.string().trim().max(255).optional(),
	linkedinUrl: z.string().trim().max(2000).optional(),
	ownerId: z.string().trim().max(64).nullable().optional(),
	source: recordSource.default("MANUAL"),
});

export type CompanyInput = z.infer<typeof companyInput>;

const SELECT = {
	id: true,
	name: true,
	domain: true,
	website: true,
	description: true,
	industry: true,
	city: true,
	country: true,
	phone: true,
	email: true,
	linkedinUrl: true,
	logoUrl: true,
	iconUrl: true,
	brandColor: true,
	ownerId: true,
	primaryContactId: true,
	source: true,
	lastActivityAt: true,
	archivedAt: true,
	version: true,
	createdAt: true,
	updatedAt: true,
} as const;

function buildWhere(input: ListInput) {
	const term = searchKey(input.search);

	return {
		AND: [
			archivedFilter(input.archived),
			ownerFilter(input.ownerIds),
			term === ""
				? {}
				: {
						OR: [
							{ nameSearch: { contains: term } },
							{ domainSearch: { contains: term } },
						],
					},
		],
	};
}

export async function listCompanies(
	db: Db,
	input: ListInput,
): Promise<ListResult<CompanyRow>> {
	const where = buildWhere(input);

	const [rows, total, active, archived] = await Promise.all([
		db.company.findMany({
			where,
			select: SELECT,
			orderBy: resolveOrderBy(input.sort, COMPANY_SORTS, input.direction),
			take: input.take,
			...cursorArgs(input.cursor),
		}),
		db.company.count({ where }),
		db.company.count({ where: { archivedAt: null } }),
		db.company.count({ where: { archivedAt: { not: null } } }),
	]);

	return paginate(rows, input, total, { active, archived });
}

export type CompanyRow = Awaited<ReturnType<typeof getCompany>>;

export async function getCompany(db: Db, id: string) {
	const row = await db.company.findUnique({ where: { id }, select: SELECT });

	if (!row) notFound("Empresa");

	return row;
}

async function assertDomainFree(
	db: Db,
	domain: string | null,
	exceptId?: string,
): Promise<void> {
	if (domain === null) return;

	const clash = await db.company.findFirst({
		where: {
			domainSearch: domain,
			archivedAt: null,
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { id: true, name: true },
	});

	if (clash) conflict(`O domínio ${domain} já pertence a ${clash.name}.`);
}

export async function createCompany(db: Db, input: CompanyInput) {
	const domain = normalizeDomain(input.domain);

	await assertDomainFree(db, domain);

	try {
		return await db.company.create({
			data: {
				name: input.name,
				nameSearch: searchKey(input.name),
				domain,
				domainSearch: domain,
				website: blankToNull(input.website),
				description: blankToNull(input.description),
				industry: blankToNull(input.industry),
				city: blankToNull(input.city),
				country: blankToNull(input.country),
				phone: blankToNull(input.phone),
				email: normalizeEmail(input.email),
				linkedinUrl: blankToNull(input.linkedinUrl),
				ownerId: input.ownerId ?? null,
				source: input.source,
			},
			select: SELECT,
		});
	} catch (error) {
		translate(error);
	}
}

export async function updateCompany(
	db: Db,
	id: string,
	version: number,
	input: Partial<CompanyInput>,
) {
	const domain =
		input.domain === undefined ? undefined : normalizeDomain(input.domain);

	if (domain !== undefined) await assertDomainFree(db, domain, id);

	return retryOnConflict(async () => {
		const updated = await db.company.updateMany({
			where: { id, version },
			data: {
				...(input.name !== undefined && {
					name: input.name,
					nameSearch: searchKey(input.name),
				}),
				...(domain !== undefined && {
					domain,
					domainSearch: optionalSearchKey(domain),
				}),
				...(input.website !== undefined && {
					website: blankToNull(input.website),
				}),
				...(input.description !== undefined && {
					description: blankToNull(input.description),
				}),
				...(input.industry !== undefined && {
					industry: blankToNull(input.industry),
				}),
				...(input.city !== undefined && { city: blankToNull(input.city) }),
				...(input.country !== undefined && {
					country: blankToNull(input.country),
				}),
				...(input.phone !== undefined && { phone: blankToNull(input.phone) }),
				...(input.email !== undefined && { email: normalizeEmail(input.email) }),
				...(input.linkedinUrl !== undefined && {
					linkedinUrl: blankToNull(input.linkedinUrl),
				}),
				...(input.ownerId !== undefined && { ownerId: input.ownerId }),
				version: { increment: 1 },
			},
		});

		if (updated.count === 0) return null;

		return getCompany(db, id);
	});
}

export async function archiveCompany(db: Db, id: string, version: number) {
	return setArchived(db, id, version, new Date());
}

export async function restoreCompany(db: Db, id: string, version: number) {
	const row = await getCompany(db, id);
	await assertDomainFree(db, row.domain, id);

	return setArchived(db, id, version, null);
}

async function setArchived(
	db: Db,
	id: string,
	version: number,
	archivedAt: Date | null,
) {
	return retryOnConflict(async () => {
		const updated = await db.company.updateMany({
			where: { id, version },
			data: { archivedAt, version: { increment: 1 } },
		});

		if (updated.count === 0) return null;

		return getCompany(db, id);
	});
}

export async function purgeCompany(
	db: Db,
	d1: D1Database,
	id: string,
): Promise<{ id: string }> {
	await getCompany(db, id);

	await batch(d1, [
		sql`DELETE FROM activity WHERE companyId = ${id}`,
		sql`DELETE FROM fieldValue WHERE companyId = ${id}`,
		sql`UPDATE contact SET companyId = NULL WHERE companyId = ${id}`,
		sql`DELETE FROM dealContact WHERE dealId IN (SELECT id FROM deal WHERE companyId = ${id})`,
		sql`DELETE FROM activity WHERE dealId IN (SELECT id FROM deal WHERE companyId = ${id})`,
		sql`DELETE FROM fieldValue WHERE dealId IN (SELECT id FROM deal WHERE companyId = ${id})`,
		sql`DELETE FROM deal WHERE companyId = ${id}`,
		sql`UPDATE company SET primaryContactId = NULL WHERE id = ${id}`,
		sql`DELETE FROM company WHERE id = ${id}`,
	]);

	return { id };
}
