import { z } from "zod";

export const PAGE_SIZE = 50;

export const MAX_PAGE_SIZE = 200;

export const sortDirection = z.enum(["asc", "desc"]);

export const listInput = z.object({
	search: z.string().trim().max(200).optional(),
	archived: z.boolean().default(false),
	ownerIds: z.array(z.string().min(1).max(64)).max(50).optional(),
	sort: z.string().min(1).max(64).optional(),
	direction: sortDirection.default("desc"),
	take: z.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
	cursor: z.string().min(1).max(64).optional(),
});

export type ListInput = z.infer<typeof listInput>;

export type ListResult<Row> = {
	rows: Row[];
	total: number;
	nextCursor: string | null;
	facetCounts: Record<string, number>;
};

export const idInput = z.object({ id: z.string().min(1).max(64) });

export const archiveInput = z.object({
	id: z.string().min(1).max(64),
	version: z.number().int().nonnegative(),
});
