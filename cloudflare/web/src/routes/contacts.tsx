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
import { formatDate, fullName } from "../lib/format";
import { useTRPC } from "../lib/trpc";

export function ContactsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [open, setOpen] = useState(false);

	const list = useQuery(
		trpc.contacts.list.queryOptions({
			search: search || undefined,
			archived: false,
			direction: "desc",
			take: 50,
		}),
	);

	const companies = useQuery(
		trpc.companies.list.queryOptions({
			archived: false,
			direction: "asc",
			sort: "name",
			take: 200,
		}),
	);

	const create = useMutation(
		trpc.contacts.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.contacts.list.pathKey() });
				setOpen(false);
				toast.success("Contato criado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const companyId = String(form.get("companyId") ?? "");

		create.mutate({
			firstName: String(form.get("firstName") ?? ""),
			lastName: String(form.get("lastName") ?? "") || undefined,
			email: String(form.get("email") ?? "") || undefined,
			title: String(form.get("title") ?? "") || undefined,
			companyId: companyId === "" ? null : companyId,
			source: "MANUAL",
		});
	}

	return (
		<>
			<PageHeader
				title="Contatos"
				search={search}
				onSearch={setSearch}
				action={
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button>Novo contato</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Novo contato</DialogTitle>
							</DialogHeader>
							<form className="flex flex-col gap-6" onSubmit={submit}>
								<div className="flex flex-col gap-2">
									<Label htmlFor="firstName">Nome</Label>
									<Input id="firstName" name="firstName" required />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="lastName">Sobrenome</Label>
									<Input id="lastName" name="lastName" />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="email">Email</Label>
									<Input id="email" name="email" type="email" />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="title">Cargo</Label>
									<Input id="title" name="title" />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="companyId">Empresa</Label>
									<select id="companyId" name="companyId" defaultValue="">
										<option value="">Sem empresa</option>
										{companies.data?.rows.map((row) => (
											<option key={row.id} value={row.id}>
												{row.name}
											</option>
										))}
									</select>
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
				<Empty>Nenhum contato encontrado.</Empty>
			) : null}

			{list.data && list.data.rows.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Nome</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Cargo</TableHead>
							<TableHead>Empresa</TableHead>
							<TableHead>Última atividade</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.data.rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell>{fullName(row.firstName, row.lastName)}</TableCell>
								<TableCell>{row.email ?? "—"}</TableCell>
								<TableCell>{row.title ?? "—"}</TableCell>
								<TableCell>{row.company?.name ?? "—"}</TableCell>
								<TableCell>{formatDate(row.lastActivityAt)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : null}
		</>
	);
}
