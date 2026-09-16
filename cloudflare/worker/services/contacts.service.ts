import { z } from "zod";
import { recordSource } from "~/shared/enums";
import type { ListInput, ListResult } from "~/shared/list";
import {
	optionalSearchKey,
	personSearchKey,
	searchKey,
} from "~/shared/search-key";
import type { Db } from "../db";
import { conflict, notFound, translate } from "../errors";
import { batch, sql } from "./batch";
import {
	archivedFilter,
	blankToNull,
	cursorArgs,
	normalizeEmail,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "./list";
import { retryOnConflict } from "./write";

export const CONTACT_SORTS = [
	"firstName",
	"createdAt",
	"updatedAt",
	"lastActivityAt",
] as const;

export const contactInput = z.object({
	firstName: z.string().trim().min(1).max(120),
	lastName: z.string().trim().max(120).optional(),
	email: z.string().trim().max(255).optional(),
	phone: z.string().trim().max(60).optional(),
	title: z.string().trim().max(160).optional(),
	seniority: z.string().trim().max(80).optional(),
	function: z.string().trim().max(80).optional(),
	linkedinUrl: z.string().trim().max(2000).optional(),
	companyId: z.string().trim().max(64).nullable().optional(),
	ownerId: z.string().trim().max(64).nullable().optional(),
	source: recordSource.default("MANUAL"),
});

export type ContactInput = z.infer<typeof contactInput>;

const SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
	title: true,
	seniority: true,
	function: true,
	linkedinUrl: true,
	imageUrl: true,
	companyId: true,
	ownerId: true,
	source: true,
	lastActivityAt: true,
	archivedAt: true,
	version: true,
	createdAt: true,
	updatedAt: true,
	company: { select: { id: true, name: true, domain: true, iconUrl: true } },
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
							{ emailSearch: { contains: term } },
						],
					},
		],
	};
}

export type ContactRow = Awaited<ReturnType<typeof getContact>>;

export async function getContact(db: Db, id: string) {
	const row = await db.contact.findUnique({ where: { id }, select: SELECT });

	if (!row) notFound("Contato");

	return row;
}

export async function listContacts(
	db: Db,
	input: ListInput,
): Promise<ListResult<ContactRow>> {
	const where = buildWhere(input);

	const [rows, total, active, archived] = await Promise.all([
		db.contact.findMany({
			where,
			select: SELECT,
			orderBy: resolveOrderBy(input.sort, CONTACT_SORTS, input.direction),
			take: input.take,
			...cursorArgs(input.cursor),
		}),
		db.contact.count({ where }),
		db.contact.count({ where: { archivedAt: null } }),
		db.contact.count({ where: { archivedAt: { not: null } } }),
	]);

	return paginate(rows, input, total, { active, archived });
}

async function assertEmailFree(
	db: Db,
	email: string | null,
	exceptId?: string,
): Promise<void> {
	if (email === null) return;

	const clash = await db.contact.findFirst({
		where: {
			emailSearch: email,
			archivedAt: null,
			...(exceptId ? { NOT: { id: exceptId } } : {}),
		},
		select: { firstName: true, lastName: true },
	});

	if (clash) {
		const who = [clash.firstName, clash.lastName].filter(Boolean).join(" ");
		conflict(`${email} já pertence a ${who}.`);
	}
}

async function liftSuppression(db: Db, email: string | null): Promise<void> {
	if (email === null) return;

	await db.suppressedContact.deleteMany({ where: { email } });
}

export async function createContact(db: Db, input: ContactInput) {
	const email = normalizeEmail(input.email);

	await assertEmailFree(db, email);

	try {
		const created = await db.contact.create({
			data: {
				firstName: input.firstName,
				lastName: blankToNull(input.lastName),
				nameSearch: personSearchKey(input.firstName, input.lastName),
				email,
				emailSearch: optionalSearchKey(email),
				phone: blankToNull(input.phone),
				title: blankToNull(input.title),
				seniority: blankToNull(input.seniority),
				function: blankToNull(input.function),
				linkedinUrl: blankToNull(input.linkedinUrl),
				companyId: input.companyId ?? null,
				ownerId: input.ownerId ?? null,
				source: input.source,
			},
			select: SELECT,
		});

		await liftSuppression(db, email);

		return created;
	} catch (error) {
		translate(error);
	}
}

export async function updateContact(
	db: Db,
	id: string,
	version: number,
	input: Partial<ContactInput>,
) {
	const email =
		input.email === undefined ? undefined : normalizeEmail(input.email);

	if (email !== undefined) await assertEmailFree(db, email, id);

	const current = await getContact(db, id);

	const firstName = input.firstName ?? current.firstName;
	const lastName =
		input.lastName === undefined
			? current.lastName
			: blankToNull(input.lastName);

	return retryOnConflict(async () => {
		const updated = await db.contact.updateMany({
			where: { id, version },
			data: {
				firstName,
				lastName,
				nameSearch: personSearchKey(firstName, lastName),
				...(email !== undefined && {
					email,
					emailSearch: optionalSearchKey(email),
				}),
				...(input.phone !== undefined && { phone: blankToNull(input.phone) }),
				...(input.title !== undefined && { title: blankToNull(input.title) }),
				...(input.seniority !== undefined && {
					seniority: blankToNull(input.seniority),
				}),
				...(input.function !== undefined && {
					function: blankToNull(input.function),
				}),
				...(input.linkedinUrl !== undefined && {
					linkedinUrl: blankToNull(input.linkedinUrl),
				}),
				...(input.companyId !== undefined && { companyId: input.companyId }),
				...(input.ownerId !== undefined && { ownerId: input.ownerId }),
				version: { increment: 1 },
			},
		});

		if (updated.count === 0) return null;

		if (email !== undefined) await liftSuppression(db, email);

		return getContact(db, id);
	});
}

export async function archiveContact(db: Db, id: string, version: number) {
	return setArchived(db, id, version, new Date());
}

export async function restoreContact(db: Db, id: string, version: number) {
	const row = await getContact(db, id);
	await assertEmailFree(db, row.email, id);

	return setArchived(db, id, version, null);
}

async function setArchived(
	db: Db,
	id: string,
	version: number,
	archivedAt: Date | null,
) {
	return retryOnConflict(async () => {
		const updated = await db.contact.updateMany({
			where: { id, version },
			data: { archivedAt, version: { increment: 1 } },
		});

		if (updated.count === 0) return null;

		return getContact(db, id);
	});
}

export async function purgeContact(
	db: Db,
	d1: D1Database,
	id: string,
): Promise<{ id: string }> {
	const row = await getContact(db, id);

	const statements = [
		sql`DELETE FROM activity WHERE contactId = ${id}`,
		sql`DELETE FROM fieldValue WHERE contactId = ${id}`,
		sql`DELETE FROM dealContact WHERE contactId = ${id}`,
		sql`UPDATE company SET primaryContactId = NULL WHERE primaryContactId = ${id}`,
		sql`DELETE FROM contact WHERE id = ${id}`,
	];

	if (row.email !== null) {
		statements.push(
			sql`INSERT OR REPLACE INTO suppressedContact (email, reason, createdAt) VALUES (${row.email}, ${"purgado no CRM"}, ${Date.now()})`,
		);
	}

	await batch(d1, statements);

	return { id };
}
