import { z } from "zod";
import { activityType, fieldEntity } from "./enums";

export const activityMeta = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("stage_change"),
		from: z.string().min(1).max(64),
		to: z.string().min(1).max(64),
	}),
	z.object({
		kind: z.literal("note"),
		pinned: z.boolean().default(false),
	}),
	z.object({
		kind: z.literal("call"),
		durationSeconds: z.number().int().nonnegative().max(86_400),
		outcome: z.enum(["connected", "voicemail", "no_answer"]),
	}),
]);

export type ActivityMeta = z.infer<typeof activityMeta>;

export function parseActivityMeta(value: string | null): ActivityMeta | null {
	if (value === null) return null;

	const parsed = activityMeta.safeParse(JSON.parse(value));
	if (!parsed.success) {
		throw new Error(
			`activity.meta ilegível: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
		);
	}

	return parsed.data;
}

export function stringifyActivityMeta(value: ActivityMeta | null): string | null {
	return value === null ? null : JSON.stringify(activityMeta.parse(value));
}

export const savedViewFilters = z.object({
	entity: fieldEntity,
	archived: z.boolean().default(false),
	search: z.string().trim().max(200).optional(),
	stages: z.array(z.string().min(1).max(64)).max(20).optional(),
	ownerIds: z.array(z.string().min(1).max(64)).max(50).optional(),
	types: z.array(activityType).max(10).optional(),
	sort: z
		.object({
			field: z.string().min(1).max(64),
			direction: z.enum(["asc", "desc"]),
		})
		.optional(),
	columns: z.array(z.string().min(1).max(64)).max(60).optional(),
});

export type SavedViewFilters = z.infer<typeof savedViewFilters>;

export function parseSavedViewFilters(value: string): SavedViewFilters {
	const parsed = savedViewFilters.safeParse(JSON.parse(value));
	if (!parsed.success) {
		throw new Error(
			`savedView.filters ilegível: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
		);
	}

	return parsed.data;
}

export function stringifySavedViewFilters(value: SavedViewFilters): string {
	return JSON.stringify(savedViewFilters.parse(value));
}

export const workspaceMetadata = z.object({
	onboardedAt: z.string().datetime().nullable().default(null),
});

export type WorkspaceMetadata = z.infer<typeof workspaceMetadata>;

export function parseWorkspaceMetadata(
	value: string | null,
): WorkspaceMetadata {
	if (value === null) return { onboardedAt: null };

	const parsed = workspaceMetadata.safeParse(JSON.parse(value));
	if (!parsed.success) return { onboardedAt: null };

	return parsed.data;
}
