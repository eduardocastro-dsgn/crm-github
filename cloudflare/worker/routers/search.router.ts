import { z } from "zod";
import { searchKey } from "~/shared/search-key";
import { protectedProcedure, router } from "../trpc";

const PER_KIND = 5;

const MIN_TERM = 2;

export const searchRouter = router({
	quick: protectedProcedure
		.input(z.object({ q: z.string().trim().max(200) }))
		.query(async ({ ctx, input }) => {
			const term = searchKey(input.q);

			if (term.length < MIN_TERM) return { hits: [] };

			const [companies, contacts, deals] = await Promise.all([
				ctx.db.company.findMany({
					where: {
						archivedAt: null,
						OR: [
							{ nameSearch: { contains: term } },
							{ domainSearch: { contains: term } },
						],
					},
					take: PER_KIND,
					orderBy: { nameSearch: "asc" },
					select: { id: true, name: true, domain: true, iconUrl: true },
				}),
				ctx.db.contact.findMany({
					where: {
						archivedAt: null,
						OR: [
							{ nameSearch: { contains: term } },
							{ emailSearch: { contains: term } },
						],
					},
					take: PER_KIND,
					orderBy: { nameSearch: "asc" },
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						imageUrl: true,
					},
				}),
				ctx.db.deal.findMany({
					where: { archivedAt: null, nameSearch: { contains: term } },
					take: PER_KIND,
					orderBy: { nameSearch: "asc" },
					select: {
						id: true,
						name: true,
						company: { select: { name: true } },
					},
				}),
			]);

			return {
				hits: [
					...companies.map((row) => ({
						kind: "company" as const,
						id: row.id,
						label: row.name,
						detail: row.domain,
						imageUrl: row.iconUrl,
					})),
					...contacts.map((row) => ({
						kind: "contact" as const,
						id: row.id,
						label: [row.firstName, row.lastName].filter(Boolean).join(" "),
						detail: row.email,
						imageUrl: row.imageUrl,
					})),
					...deals.map((row) => ({
						kind: "deal" as const,
						id: row.id,
						label: row.name,
						detail: row.company.name,
						imageUrl: null,
					})),
				],
			};
		}),
});
