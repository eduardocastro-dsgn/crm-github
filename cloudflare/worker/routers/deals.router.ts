import { z } from "zod";
import { dealStage } from "~/shared/enums";
import { archiveInput, idInput, listInput } from "~/shared/list";
import { reportingCurrency } from "../env";
import {
	archiveDeal,
	attachContact,
	attachContactInput,
	createDeal,
	dealContacts,
	dealInput,
	detachContact,
	getDeal,
	listDeals,
	moveStage,
	pipelineTotals,
	purgeDeal,
	restoreDeal,
	updateDeal,
} from "../services/deals.service";
import { protectedProcedure, router } from "../trpc";

const dealListInput = listInput.extend({
	stages: z.array(dealStage).max(7).optional(),
});

export const dealsRouter = router({
	list: protectedProcedure
		.input(dealListInput)
		.query(({ ctx, input }) =>
			listDeals(ctx.db, input, reportingCurrency(ctx.env)),
		),

	pipeline: protectedProcedure.query(({ ctx }) =>
		pipelineTotals(ctx.db, reportingCurrency(ctx.env)),
	),

	byId: protectedProcedure
		.input(idInput)
		.query(({ ctx, input }) => getDeal(ctx.db, input.id)),

	contacts: protectedProcedure
		.input(idInput)
		.query(({ ctx, input }) => dealContacts(ctx.db, input.id)),

	create: protectedProcedure
		.input(dealInput)
		.mutation(({ ctx, input }) =>
			createDeal(ctx.db, input, reportingCurrency(ctx.env)),
		),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1).max(64),
				version: z.number().int().nonnegative(),
				data: dealInput.partial(),
			}),
		)
		.mutation(({ ctx, input }) =>
			updateDeal(
				ctx.db,
				input.id,
				input.version,
				input.data,
				reportingCurrency(ctx.env),
			),
		),

	moveStage: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1).max(64),
				version: z.number().int().nonnegative(),
				stage: dealStage,
			}),
		)
		.mutation(({ ctx, input }) =>
			moveStage(ctx.db, ctx.user.id, input.id, input.version, input.stage),
		),

	attachContact: protectedProcedure
		.input(attachContactInput)
		.mutation(({ ctx, input }) => attachContact(ctx.db, input)),

	detachContact: protectedProcedure
		.input(
			z.object({
				dealId: z.string().min(1).max(64),
				contactId: z.string().min(1).max(64),
			}),
		)
		.mutation(({ ctx, input }) =>
			detachContact(ctx.db, input.dealId, input.contactId),
		),

	archive: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) => archiveDeal(ctx.db, input.id, input.version)),

	restore: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) => restoreDeal(ctx.db, input.id, input.version)),

	purge: protectedProcedure
		.input(idInput)
		.mutation(({ ctx, input }) => purgeDeal(ctx.db, ctx.env.DB, input.id)),
});
