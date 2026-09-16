import { capabilities } from "../capabilities";
import { reportingCurrency } from "../env";
import {
	changeRole,
	changeRoleInput,
	getWorkspace,
	listMembers,
	listUsers,
	updateWorkspace,
	updateWorkspaceInput,
} from "../services/workspace.service";
import { ownerProcedure, protectedProcedure, router } from "../trpc";

export const workspaceRouter = router({
	get: protectedProcedure.query(({ ctx }) => getWorkspace(ctx.db)),

	capabilities: protectedProcedure.query(({ ctx }) => ({
		...capabilities(ctx.env),
		reportingCurrency: reportingCurrency(ctx.env),
	})),

	members: protectedProcedure.query(({ ctx }) => listMembers(ctx.db)),

	users: protectedProcedure.query(({ ctx }) => listUsers(ctx.db)),

	update: ownerProcedure
		.input(updateWorkspaceInput)
		.mutation(({ ctx, input }) => updateWorkspace(ctx.db, input)),

	changeRole: ownerProcedure
		.input(changeRoleInput)
		.mutation(({ ctx, input }) => changeRole(ctx.db, input)),
});
