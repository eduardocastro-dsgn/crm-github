import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "~/worker/routers";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function createClient() {
	return createTRPCClient<AppRouter>({
		links: [httpBatchLink({ url: "/api/trpc" })],
	});
}
