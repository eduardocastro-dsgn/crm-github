import { WORKSPACE_ID } from "~/shared/workspace";
import type { Db } from "../db";
import { purgeCompany } from "./companies.service";
import { purgeContact } from "./contacts.service";
import { purgeDeal } from "./deals.service";

const DAY_MS = 86_400_000;

const MAX_BATCH = 100;

const DEFAULT_RETENTION_DAYS = 180;

export async function pruneArchive(
	db: Db,
	d1: D1Database,
): Promise<{ companies: number; contacts: number; deals: number }> {
	const setting = await db.appSetting.findUnique({
		where: { id: WORKSPACE_ID },
		select: { archiveRetentionDays: true },
	});

	const days = setting?.archiveRetentionDays ?? DEFAULT_RETENTION_DAYS;
	const before = new Date(Date.now() - days * DAY_MS);
	const where = { archivedAt: { lte: before } };

	const [deals, contacts, companies] = await Promise.all([
		db.deal.findMany({ where, select: { id: true }, take: MAX_BATCH }),
		db.contact.findMany({ where, select: { id: true }, take: MAX_BATCH }),
		db.company.findMany({ where, select: { id: true }, take: MAX_BATCH }),
	]);

	for (const deal of deals) await safely(() => purgeDeal(db, d1, deal.id));
	for (const contact of contacts)
		await safely(() => purgeContact(db, d1, contact.id));
	for (const company of companies)
		await safely(() => purgeCompany(db, d1, company.id));

	return {
		companies: companies.length,
		contacts: contacts.length,
		deals: deals.length,
	};
}

async function safely(run: () => Promise<unknown>): Promise<void> {
	try {
		await run();
	} catch (error) {
		console.log({
			message: "Poda do arquivo falhou num registro",
			reason: error instanceof Error ? error.message : "desconhecido",
		});
	}
}
