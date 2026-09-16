import { router } from "../trpc";
import { activitiesRouter } from "./activities.router";
import { companiesRouter } from "./companies.router";
import { contactsRouter } from "./contacts.router";
import { dealsRouter } from "./deals.router";
import { searchRouter } from "./search.router";
import { workspaceRouter } from "./workspace.router";

export const appRouter = router({
	workspace: workspaceRouter,
	companies: companiesRouter,
	contacts: contactsRouter,
	deals: dealsRouter,
	activities: activitiesRouter,
	search: searchRouter,
});

export type AppRouter = typeof appRouter;
