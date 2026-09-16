import {
	DEFAULT_WORKSPACE_NAME,
	DEFAULT_WORKSPACE_SLUG,
	WORKSPACE_ID,
} from "~/shared/workspace";
import type { Db } from "./db";

export async function ensureWorkspaceMembership(
	db: Db,
	userId: string,
): Promise<void> {
	try {
		await db.organization.upsert({
			where: { id: WORKSPACE_ID },
			create: {
				id: WORKSPACE_ID,
				name: DEFAULT_WORKSPACE_NAME,
				slug: DEFAULT_WORKSPACE_SLUG,
				createdAt: new Date(),
			},
			update: {},
		});

		const existing = await db.member.findUnique({
			where: { organizationId_userId: { organizationId: WORKSPACE_ID, userId } },
			select: { id: true },
		});

		if (existing) return;

		const members = await db.member.count({
			where: { organizationId: WORKSPACE_ID },
		});

		await db.member.create({
			data: {
				id: crypto.randomUUID(),
				organizationId: WORKSPACE_ID,
				userId,
				role: members === 0 ? "owner" : "member",
				createdAt: new Date(),
			},
		});
	} catch (error) {
		console.log({
			message: "ensureWorkspaceMembership falhou",
			userId,
			reason: error instanceof Error ? error.message : "desconhecido",
		});
	}
}
