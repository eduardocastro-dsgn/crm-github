import type { ListInput, ListResult } from "~/shared/list";
import { badRequest } from "../errors";

export function archivedFilter(archived: boolean) {
	return archived ? { archivedAt: { not: null } } : { archivedAt: null };
}

export function resolveOrderBy(
	sort: string | undefined,
	allowed: readonly string[],
	direction: "asc" | "desc",
): Record<string, "asc" | "desc"> {
	if (!sort) return { updatedAt: direction };

	if (!allowed.includes(sort)) {
		badRequest(`Não é possível ordenar por "${sort}".`);
	}

	return { [sort]: direction };
}

export function ownerFilter(ownerIds: readonly string[] | undefined) {
	if (!ownerIds || ownerIds.length === 0) return {};

	return { ownerId: { in: [...ownerIds] } };
}

export type CursorArgs = {
	cursor?: { id: string };
	skip?: number;
};

export function cursorArgs(cursor: string | undefined): CursorArgs {
	return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

export function paginate<Row extends { id: string }>(
	rows: Row[],
	input: ListInput,
	total: number,
	facetCounts: Record<string, number>,
): ListResult<Row> {
	const full = rows.length === input.take;
	const last = rows.at(-1);

	return {
		rows,
		total,
		nextCursor: full && last ? last.id : null,
		facetCounts,
	};
}

export function blankToNull(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;

	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

export function normalizeEmail(value: string | null | undefined): string | null {
	const trimmed = blankToNull(value);
	return trimmed === null ? null : trimmed.toLowerCase();
}

export function normalizeDomain(value: string | null | undefined): string | null {
	const trimmed = blankToNull(value);
	if (trimmed === null) return null;

	const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
	const host = withoutScheme.split("/")[0] ?? "";
	const bare = host.replace(/^www\./i, "").toLowerCase();

	return bare === "" ? null : bare;
}
