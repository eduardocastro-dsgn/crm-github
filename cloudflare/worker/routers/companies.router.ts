import { z } from "zod";
import { archiveInput, idInput, listInput } from "~/shared/list";
import {
	archiveCompany,
	companyInput,
	createCompany,
	getCompany,
	listCompanies,
	purgeCompany,
	restoreCompany,
	updateCompany,
} from "../services/companies.service";
import { protectedProcedure, router } from "../trpc";

export const companiesRouter = router({
	list: protectedProcedure
		.input(listInput)
		.query(({ ctx, input }) => listCompanies(ctx.db, input)),

	byId: protectedProcedure
		.input(idInput)
		.query(({ ctx, input }) => getCompany(ctx.db, input.id)),

	create: protectedProcedure
		.input(companyInput)
		.mutation(({ ctx, input }) => createCompany(ctx.db, input)),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1).max(64),
				version: z.number().int().nonnegative(),
				data: companyInput.partial(),
			}),
		)
		.mutation(({ ctx, input }) =>
			updateCompany(ctx.db, input.id, input.version, input.data),
		),

	archive: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) =>
			archiveCompany(ctx.db, input.id, input.version),
		),

	restore: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) =>
			restoreCompany(ctx.db, input.id, input.version),
		),

	purge: protectedProcedure
		.input(idInput)
		.mutation(({ ctx, input }) => purgeCompany(ctx.db, ctx.env.DB, input.id)),
});
