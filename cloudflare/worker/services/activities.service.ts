import { z } from "zod";
import { activityType } from "~/shared/enums";
import { type ActivityMeta, stringifyActivityMeta } from "~/shared/json";
import type { Db } from "../db";
import { badRequest, notFound, translate } from "../errors";
import { blankToNull, cursorArgs } from "./list";

export const activityInput = z.object({
	type: activityType,
	subject: z.string().trim().max(300).optional(),
	body: z.string().trim().max(20_000).optional(),
	occurredAt: z.coerce.date().optional(),
	dueAt: z.coerce.date().optional(),
	companyId: z.string().trim().max(64).nullable().optional(),
	contactId: z.string().trim().max(64).nullable().optional(),
	dealId: z.string().trim().max(64).nullable().optional(),
});

export type ActivityInput = z.infer<typeof activityInput>;

export const timelineInput = z.object({
	companyId: z.string().trim().max(64).optional(),
	contactId: z.string().trim().max(64).optional(),
	dealId: z.string().trim().max(64).optional(),
	take: z.number().int().min(1).max(100).default(30),
	cursor: z.string().min(1).max(64).optional(),
});

export type TimelineInput = z.infer<typeof timelineInput>;

const SELECT = {
	id: true,
	type: true,
	subject: true,
	body: true,
	occurredAt: true,
	dueAt: true,
	completedAt: true,
	companyId: true,
	contactId: true,
	dealId: true,
	meta: true,
	createdAt: true,
	createdBy: { select: { id: true, name: true, image: true } },
} as const;

export async function timeline(db: Db, input: TimelineInput) {
	if (!input.companyId && !input.contactId && !input.dealId) {
		badRequest("A linha do tempo precisa de uma empresa, contato ou negócio.");
	}

	const rows = await db.activity.findMany({
		where: {
			...(input.companyId && { companyId: input.companyId }),
			...(input.contactId && { contactId: input.contactId }),
			...(input.dealId && { dealId: input.dealId }),
		},
		select: SELECT,
		orderBy: { createdAt: "desc" },
		take: input.take,
		...cursorArgs(input.cursor),
	});

	const last = rows.at(-1);

	return {
		rows,
		nextCursor: rows.length === input.take && last ? last.id : null,
	};
}

export async function createActivity(
	db: Db,
	userId: string,
	input: ActivityInput,
	meta: ActivityMeta | null = null,
) {
	if (!input.companyId && !input.contactId && !input.dealId) {
		badRequest("Uma atividade precisa de um registro.");
	}

	try {
		const created = await db.activity.create({
			data: {
				type: input.type,
				subject: blankToNull(input.subject),
				body: blankToNull(input.body),
				occurredAt: input.occurredAt ?? new Date(),
				dueAt: input.dueAt ?? null,
				companyId: input.companyId ?? null,
				contactId: input.contactId ?? null,
				dealId: input.dealId ?? null,
				createdById: userId,
				meta: stringifyActivityMeta(meta),
			},
			select: SELECT,
		});

		await stampActivity(db, {
			companyId: created.companyId,
			contactId: created.contactId,
			dealId: created.dealId,
		});

		return created;
	} catch (error) {
		translate(error);
	}
}

export async function completeActivity(db: Db, id: string) {
	const row = await db.activity.findUnique({
		where: { id },
		select: { id: true, completedAt: true },
	});

	if (!row) notFound("Atividade");

	return db.activity.update({
		where: { id },
		data: { completedAt: row.completedAt === null ? new Date() : null },
		select: SELECT,
	});
}

export type StampTargets = {
	companyId: string | null;
	contactId: string | null;
	dealId: string | null;
};

export async function stampActivity(
	db: Db,
	targets: StampTargets,
): Promise<void> {
	const now = new Date();
	const writes = [];

	if (targets.companyId) {
		writes.push(
			db.company.update({
				where: { id: targets.companyId },
				data: { lastActivityAt: now },
				select: { id: true },
			}),
		);
	}

	if (targets.contactId) {
		writes.push(
			db.contact.update({
				where: { id: targets.contactId },
				data: { lastActivityAt: now },
				select: { id: true },
			}),
		);
	}

	if (targets.dealId) {
		writes.push(
			db.deal.update({
				where: { id: targets.dealId },
				data: { lastActivityAt: now },
				select: { id: true },
			}),
		);
	}

	const results = await Promise.allSettled(writes);

	for (const result of results) {
		if (result.status === "rejected") {
			console.log({
				message: "Carimbo de lastActivityAt falhou",
				reason: String(result.reason),
			});
		}
	}
}
