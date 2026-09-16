import { Button } from "@crm/ui/components/button";
import { Separator } from "@crm/ui/components/separator";
import { NavLink, Outlet, useNavigate } from "react-router";
import { signOut, useSession } from "../lib/auth-client";
import { useTRPC } from "../lib/trpc";
import { useQuery } from "@tanstack/react-query";

const LINKS = [
	{ to: "/deals", label: "Negócios" },
	{ to: "/companies", label: "Empresas" },
	{ to: "/contacts", label: "Contatos" },
	{ to: "/settings", label: "Ajustes" },
];

export function Shell() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());

	async function leave() {
		await signOut();
		navigate("/sign-in", { replace: true });
	}

	return (
		<div className="min-h-svh">
			<header className="flex items-center gap-6 px-6 py-4">
				<span className="font-medium">
					{workspace.data ? `${workspace.data.name} CRM` : "CRM"}
				</span>

				<nav className="flex items-center gap-1">
					{LINKS.map((link) => (
						<NavLink key={link.to} to={link.to}>
							{({ isActive }) => (
								<Button variant={isActive ? "secondary" : "ghost"} size="sm">
									{link.label}
								</Button>
							)}
						</NavLink>
					))}
				</nav>

				<div className="ml-auto flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{session?.user.email}
					</span>
					<Button variant="outline" size="sm" onClick={leave}>
						Sair
					</Button>
				</div>
			</header>

			<Separator />

			<main className="p-6">
				<Outlet />
			</main>
		</div>
	);
}
