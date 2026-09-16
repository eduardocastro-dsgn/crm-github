import { z } from "zod";
import { DEAL_STAGES, dealStage } from "~/shared/enums";
import type { ListInput, ListResult } from "~/shared/list";
import { type Cents, currencyCode, MAX_CENTS } from "~/shared/money";
import { searchKey } from "~/shared/search-key";
import type { Db } from "../db";
import { notFound, translate } from "../errors";
import { createActivity } from "./activities.service";
import { batch, sql } from "./batch";
import {
	countedWhere,
	dealMoney,
	pendingWhere,
	reportingCurrencyOf,
} from "./conversion.service";
import {
	archivedFilter,
	blankToNull,
	cursorArgs,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "./list";
import { retryOnConflict } from "./write";

export const DEAL_SORTS = [
	"name",
	"stage",
	"baseAmount",
	"expectedCloseDate",
	"createdAt",
	"updatedAt",
	"lastActivityAt",
] as const;

export const dealInput = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(5000).optional(),
	companyId: z.string().trim().min(1).max(64),
	ownerId: z.string().trim().min(1).max(64),
	stage: dealStage.default("DEMO_BOOKED"),
	amount: z.number().int().min(0).max(MAX_CENTS).nullable().optional(),
	currency: currencyCode.default("BRL"),
	expectedCloseDate: z.coerce.date().nullable().optional(),
});

export type DealInput = z.infer<typeof dealInput>;

const SELECT = {
	id: true,
	name: true,
	description: true,
	stage: true,
	stageChangedAt: true,
	amount: true,
	currency: true,
	baseAmount: true,
	baseCurrency: true,
	fxRate: true,
	fxRateAt: true,
	expectedCloseDate: true,
	closedAt: true,
	closedReason: true,
	companyId: true,
	ownerId: true,
	lastActivityAt: true,
	archivedAt: true,
	version: true,
	createdAt: true,
	updatedAt: true,
	company: { select: { id: true, name: true, domain: true, iconUrl: true } },
	owner: { select: { id: true, name: true, image: true } },
} as const;

export type DealRow = Awaited<ReturnType<typeof getDeal>>;

export async function getDeal(db: Db, id: string) {
	const row = await db.deal.findUnique({ where: { id }, select: SELECT });

	if (!row) notFound("Negócio");

	return row;
}

function buildWhere(input: ListInput, stages: readonly string[] | undefined) {
	const term = searchKey(input.search);

	return {
		AND: [
			archivedFilter(input.archived),
			ownerFilter(input.ownerIds),
			stages && stages.length > 0 ? { stage: { in: [...stages] } } : {},
			term === "" ? {} : { nameSearch: { contains: term } },
		],
	};
}

export async function listDeals(
	db: Db,
	input: ListInput & { stages?: readonly string[] },
	fallbackCurrency: string,
): Promise<ListResult<DealRow> & { base: string; unconverted: number }> {
	const where = buildWhere(input, input.stages);
	const base = await reportingCurrencyOf(db, fallbackCurrency);

	const [rows, total, unconverted, byStage] = await Promise.all([
		db.deal.findMany({
			where,
			select: SELECT,
			orderBy: resolveOrderBy(input.sort, DEAL_SORTS, input.direction),
			take: input.take,
			...cursorArgs(input.cursor),
		}),
		db.deal.count({ where }),
		db.deal.count({
			where: { AND: [archivedFilter(input.archived), pendingWhere(base)] },
		}),
		db.deal.groupBy({
			by: ["stage"],
			where: archivedFilter(input.archived),
			_count: { _all: true },
		}),
	]);

	const facetCounts: Record<string, number> = {};
	for (const group of byStage) facetCounts[group.stage] = group._count._all;

	return { ...paginate(rows, input, total, facetCounts), base, unconverted };
}

export async function pipelineTotals(db: Db, fallbackCurrency: string) {
	const base = await reportingCurrencyOf(db, fallbackCurrency);

	const sums = await db.deal.groupBy({
		by: ["stage"],
		where: { AND: [archivedFilter(false), countedWhere(base)] },
		_sum: { baseAmount: true },
		_count: { _all: true },
	});

	const counts = await db.deal.groupBy({
		by: ["stage"],
		where: archivedFilter(false),
		_count: { _all: true },
	});

	return {
		base,
		stages: DEAL_STAGES.map((stage) => ({
			stage,
			total: (sums.find((row) => row.stage === stage)?._sum.baseAmount ??
				0) as Cents,
			counted: sums.find((row) => row.stage === stage)?._count._all ?? 0,
			count: counts.find((row) => row.stage === stage)?._count._all ?? 0,
		})),
	};
}

export async function createDeal(
	db: Db,
	input: DealInput,
	fallbackCurrency: string,
) {
	const money = await dealMoney(
		db,
		(input.amount ?? null) as Cents | null,
		input.currency,
		fallbackCurrency,
	);

	try {
		return await db.deal.create({
			data: {
				name: input.name,
				nameSearch: searchKey(input.name),
				description: blankToNull(input.description),
				companyId: input.companyId,
				ownerId: input.ownerId,
				stage: input.stage,
				stageChangedAt: new Date(),
				amount: money.amount,
				currency: money.currency,
				baseAmount: money.baseAmount,
				baseCurrency: money.baseCurrency,
				fxRate: money.fxRate,
				fxRateAt: money.fxRateAt,
				expectedCloseDate: input.expectedCloseDate ?? null,
			},
			select: SELECT,
		});
	} catch (error) {
		translate(error);
	}
}

export async function updateDeal(
	db: Db,
	id: string,
	version: number,
	input: Partial<DealInput>,
	fallbackCurrency: string,
) {
	const current = await getDeal(db, id);

	const amountChanged = input.amount !== undefined;
	const currencyChanged = input.currency !== undefined;

	const money =
		amountChanged || currencyChanged
			? await dealMoney(
					db,
					(amountChanged ? (input.amount ?? null) : current.amount) as
						| Cents
						| null,
					input.currency ?? current.currency,
					fallbackCurrency,
				)
			: null;

	return retryOnConflict(async () => {
		const updated = await db.deal.updateMany({
			where: { id, version },
			data: {
				...(input.name !== undefined && {
					name: input.name,
					nameSearch: searchKey(input.name),
				}),
				...(input.description !== undefined && {
					description: blankToNull(input.description),
				}),
				...(input.companyId !== undefined && { companyId: input.companyId }),
				...(input.ownerId !== undefined && { ownerId: input.ownerId }),
				...(input.expectedCloseDate !== undefined && {
					expectedCloseDate: input.expectedCloseDate,
				}),
				...(money !== null && {
					amount: money.amount,
					currency: money.currency,
					baseAmount: money.baseAmount,
					baseCurrency: money.baseCurrency,
					fxRate: money.fxRate,
					fxRateAt: money.fxRateAt,
				}),
				version: { increment: 1 },
			},
		});

		if (updated.count === 0) return null;

		return getDeal(db, id);
	});
}

export async function moveStage(
	db: Db,
	userId: string,
	id: string,
	version: number,
	stage: z.infer<typeof dealStage>,
) {
	const current = await getDeal(db, id);

	if (current.stage === stage) return current;

	const closing = stage === "CLOSED_WON" || stage === "CLOSED_LOST";

	const moved = await retryOnConflict(async () => {
		const updated = await db.deal.updateMany({
			where: { id, version },
			data: {
				stage,
				stageChangedAt: new Date(),
				closedAt: closing ? new Date() : null,
				version: { increment: 1 },
			},
		});

		if (updated.count === 0) return null;

		return getDeal(db, id);
	});

	await createActivity(
		db,
		userId,
		{ type: "STAGE_CHANGE", dealId: id, companyId: current.companyId },
		{ kind: "stage_change", from: current.stage, to: stage },
	);

	return moved;
}

export async function archiveDeal(db: Db, id: string, version: number) {
	return setArchived(db, id, version, new Date());
}

export async function restoreDeal(db: Db, id: string, version: number) {
	return setArchived(db, id, version, null);
}

async function setArchived(
	db: Db,
	id: string,
	version: number,
	archivedAt: Date | null,
) {
	return retryOnConflict(async () => {
		const updated = await db.deal.updateMany({
			where: { id, version },
			data: { archivedAt, version: { increment: 1 } },
		});

		if (updated.count === 0) return null;

		return getDeal(db, id);
	});
}

export async function purgeDeal(
	db: Db,
	d1: D1Database,
	id: string,
): Promise<{ id: string }> {
	await getDeal(db, id);

	await batch(d1, [
		sql`DELETE FROM activity WHERE dealId = ${id}`,
		sql`DELETE FROM fieldValue WHERE dealId = ${id}`,
		sql`DELETE FROM dealContact WHERE dealId = ${id}`,
		sql`DELETE FROM deal WHERE id = ${id}`,
	]);

	return { id };
}

export const attachContactInput = z.object({
	dealId: z.string().trim().min(1).max(64),
	contactId: z.string().trim().min(1).max(64),
	role: z.string().trim().max(120).optional(),
});

export async function attachContact(
	db: Db,
	input: z.infer<typeof attachContactInput>,
) {
	const [deal, contact] = await Promise.all([
		getDeal(db, input.dealId),
		db.contact.findUnique({
			where: { id: input.contactId },
			select: { id: true, companyId: true },
		}),
	]);

	if (!contact) notFound("Contato");

	if (contact.companyId !== deal.companyId) {
		translate({ code: "P2003" });
	}

	const role = blankToNull(input.role);

	const existing = await db.dealContact.findUnique({
		where: {
			dealId_contactId: { dealId: input.dealId, contactId: input.contactId },
		},
		select: { role: true },
	});

	return db.dealContact.upsert({
		where: {
			dealId_contactId: { dealId: input.dealId, contactId: input.contactId },
		},
		create: { dealId: input.dealId, contactId: input.contactId, role },
		update: { role: role ?? existing?.role ?? null },
		select: { dealId: true, contactId: true, role: true },
	});
}

export async function detachContact(db: Db, dealId: string, contactId: string) {
	await db.dealContact.deleteMany({ where: { dealId, contactId } });

	return { dealId, contactId };
}

export async function dealContacts(db: Db, dealId: string) {
	return db.dealContact.findMany({
		where: { dealId },
		select: {
			role: true,
			contact: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					title: true,
					imageUrl: true,
				},
			},
		},
	});
}
