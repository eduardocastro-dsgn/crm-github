import { z } from "zod";
import { workspaceRole } from "~/shared/enums";
import { parseWorkspaceMetadata } from "~/shared/json";
import {
	DEFAULT_WORKSPACE_NAME,
	WORKSPACE_ID,
	workspaceSlug,
} from "~/shared/workspace";
import type { Db } from "../db";
import { conflict, forbidden, notFound } from "../errors";
import { normalizeDomain } from "./list";
import { retryOnConflict } from "./write";

export const updateWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
	website: z.string().trim().min(1).max(255),
	version: z.number().int().nonnegative(),
});

export const changeRoleInput = z.object({
	userId: z.string().trim().min(1).max(64),
	role: workspaceRole,
});

export async function getWorkspace(db: Db) {
	const row = await db.organization.findUnique({
		where: { id: WORKSPACE_ID },
		select: {
			id: true,
			name: true,
			slug: true,
			website: true,
			metadata: true,
			version: true,
		},
	});

	if (!row) notFound("Workspace");

	return {
		...row,
		isDefaultName: row.name === DEFAULT_WORKSPACE_NAME,
		onboardedAt: parseWorkspaceMetadata(row.metadata).onboardedAt,
	};
}

export async function updateWorkspace(
	db: Db,
	input: z.infer<typeof updateWorkspaceInput>,
) {
	const website = normalizeDomain(input.website);

	if (website === null) conflict("O site precisa de um domínio válido.");

	return retryOnConflict(async () => {
		const updated = await db.organization.updateMany({
			where: { id: WORKSPACE_ID, version: input.version },
			data: {
				name: input.name,
				slug: workspaceSlug(input.name),
				website,
				metadata: JSON.stringify({ onboardedAt: new Date().toISOString() }),
				version: { increment: 1 },
			},
		});

		if (updated.count === 0) return null;

		return getWorkspace(db);
	});
}

export async function listMembers(db: Db) {
	return db.member.findMany({
		where: { organizationId: WORKSPACE_ID },
		select: {
			id: true,
			role: true,
			version: true,
			createdAt: true,
			user: { select: { id: true, name: true, email: true, image: true } },
		},
		orderBy: { createdAt: "asc" },
	});
}

export async function memberRole(
	db: Db,
	userId: string,
): Promise<string | null> {
	const member = await db.member.findUnique({
		where: { organizationId_userId: { organizationId: WORKSPACE_ID, userId } },
		select: { role: true },
	});

	return member?.role ?? null;
}

export async function changeRole(
	db: Db,
	input: z.infer<typeof changeRoleInput>,
) {
	const member = await db.member.findUnique({
		where: {
			organizationId_userId: {
				organizationId: WORKSPACE_ID,
				userId: input.userId,
			},
		},
		select: { id: true, role: true, version: true },
	});

	if (!member) notFound("Membro");

	if (member.role === "owner" && input.role !== "owner") {
		const owners = await db.member.count({
			where: { organizationId: WORKSPACE_ID, role: "owner" },
		});

		if (owners <= 1) forbidden("O último dono não pode perder o cargo.");
	}

	return retryOnConflict(async () => {
		const updated = await db.member.updateMany({
			where: { id: member.id, version: member.version },
			data: { role: input.role, version: { increment: 1 } },
		});

		if (updated.count === 0) return null;

		return listMembers(db);
	});
}

export async function listUsers(db: Db) {
	return db.user.findMany({
		select: { id: true, name: true, email: true, image: true },
		orderBy: { name: "asc" },
		take: 200,
	});
}
