import { z } from "zod";
import { archiveInput, idInput, listInput } from "~/shared/list";
import {
	archiveContact,
	contactInput,
	createContact,
	getContact,
	listContacts,
	purgeContact,
	restoreContact,
	updateContact,
} from "../services/contacts.service";
import { protectedProcedure, router } from "../trpc";

export const contactsRouter = router({
	list: protectedProcedure
		.input(listInput)
		.query(({ ctx, input }) => listContacts(ctx.db, input)),

	byId: protectedProcedure
		.input(idInput)
		.query(({ ctx, input }) => getContact(ctx.db, input.id)),

	create: protectedProcedure
		.input(contactInput)
		.mutation(({ ctx, input }) => createContact(ctx.db, input)),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1).max(64),
				version: z.number().int().nonnegative(),
				data: contactInput.partial(),
			}),
		)
		.mutation(({ ctx, input }) =>
			updateContact(ctx.db, input.id, input.version, input.data),
		),

	archive: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) =>
			archiveContact(ctx.db, input.id, input.version),
		),

	restore: protectedProcedure
		.input(archiveInput)
		.mutation(({ ctx, input }) =>
			restoreContact(ctx.db, input.id, input.version),
		),

	purge: protectedProcedure
		.input(idInput)
		.mutation(({ ctx, input }) => purgeContact(ctx.db, ctx.env.DB, input.id)),
});
