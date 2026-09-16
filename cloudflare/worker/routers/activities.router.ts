import { idInput } from "~/shared/list";
import {
	activityInput,
	completeActivity,
	createActivity,
	timeline,
	timelineInput,
} from "../services/activities.service";
import { protectedProcedure, router } from "../trpc";

export const activitiesRouter = router({
	timeline: protectedProcedure
		.input(timelineInput)
		.query(({ ctx, input }) => timeline(ctx.db, input)),

	create: protectedProcedure
		.input(activityInput)
		.mutation(({ ctx, input }) => createActivity(ctx.db, ctx.user.id, input)),

	toggleComplete: protectedProcedure
		.input(idInput)
		.mutation(({ ctx, input }) => completeActivity(ctx.db, input.id)),
});
