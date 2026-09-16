import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Empty } from "@crm/ui/components/empty";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "../components/page-header";
import { formatDate } from "../lib/format";
import { useTRPC } from "../lib/trpc";

export function CompaniesPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [open, setOpen] = useState(false);

	const list = useQuery(
		trpc.companies.list.queryOptions({
			search: search || undefined,
			archived: false,
			direction: "desc",
			take: 50,
		}),
	);

	const create = useMutation(
		trpc.companies.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.companies.list.pathKey() });
				setOpen(false);
				toast.success("Empresa criada.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);

		create.mutate({
			name: String(form.get("name") ?? ""),
			domain: String(form.get("domain") ?? "") || undefined,
			industry: String(form.get("industry") ?? "") || undefined,
			city: String(form.get("city") ?? "") || undefined,
			source: "MANUAL",
		});
	}

	return (
		<>
			<PageHeader
				title="Empresas"
				search={search}
				onSearch={setSearch}
				action={
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button>Nova empresa</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Nova empresa</DialogTitle>
							</DialogHeader>
							<form className="flex flex-col gap-6" onSubmit={submit}>
								<div className="flex flex-col gap-2">
									<Label htmlFor="name">Nome</Label>
									<Input id="name" name="name" required />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="domain">Domínio</Label>
									<Input id="domain" name="domain" placeholder="exemplo.com.br" />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="industry">Setor</Label>
									<Input id="industry" name="industry" />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="city">Cidade</Label>
									<Input id="city" name="city" />
								</div>
								<DialogFooter>
									<Button type="submit" disabled={create.isPending}>
										{create.isPending ? "Salvando" : "Criar"}
									</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>
				}
			/>

			{list.isPending ? <Spinner /> : null}

			{list.data && list.data.rows.length === 0 ? (
				<Empty>Nenhuma empresa encontrada.</Empty>
			) : null}

			{list.data && list.data.rows.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Nome</TableHead>
							<TableHead>Domínio</TableHead>
							<TableHead>Setor</TableHead>
							<TableHead>Cidade</TableHead>
							<TableHead>Última atividade</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.data.rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell>{row.name}</TableCell>
								<TableCell>{row.domain ?? "—"}</TableCell>
								<TableCell>{row.industry ?? "—"}</TableCell>
								<TableCell>{row.city ?? "—"}</TableCell>
								<TableCell>{formatDate(row.lastActivityAt)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : null}
		</>
	);
}
