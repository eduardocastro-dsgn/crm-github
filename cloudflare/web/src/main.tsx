import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import { createClient, TRPCProvider } from "./lib/trpc";
import "./styles.css";

function Root() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
			}),
	);
	const [trpcClient] = useState(createClient);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</TRPCProvider>
		</QueryClientProvider>
	);
}

const container = document.getElementById("root");

if (!container) throw new Error("A raiz #root não existe no index.html.");

createRoot(container).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
