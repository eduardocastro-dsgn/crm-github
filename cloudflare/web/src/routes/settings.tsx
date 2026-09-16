import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
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
import { type FormEvent } from "react";
import { toast } from "sonner";
import { useTRPC } from "../lib/trpc";

export function SettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const members = useQuery(trpc.workspace.members.queryOptions());
	const capabilities = useQuery(trpc.workspace.capabilities.queryOptions());

	const update = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.workspace.get.pathKey() });
				toast.success("Workspace atualizado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!workspace.data) return;

		const form = new FormData(event.currentTarget);

		update.mutate({
			name: String(form.get("name") ?? ""),
			website: String(form.get("website") ?? ""),
			version: workspace.data.version,
		});
	}

	if (workspace.isPending) return <Spinner />;

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Workspace</CardTitle>
					<CardDescription>O nome aparece no cabeçalho e na URL.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="flex flex-col gap-6" onSubmit={submit}>
						<div className="flex flex-col gap-2">
							<Label htmlFor="name">Nome</Label>
							<Input
								id="name"
								name="name"
								required
								defaultValue={workspace.data?.name}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="website">Site</Label>
							<Input
								id="website"
								name="website"
								required
								defaultValue={workspace.data?.website ?? ""}
								placeholder="exemplo.com.br"
							/>
						</div>
						<Button type="submit" disabled={update.isPending}>
							{update.isPending ? "Salvando" : "Salvar"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Pessoas</CardTitle>
					<CardDescription>
						Quem entra vira membro do workspace automaticamente.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Nome</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Cargo</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.data?.map((member) => (
								<TableRow key={member.id}>
									<TableCell>{member.user.name}</TableCell>
									<TableCell>{member.user.email}</TableCell>
									<TableCell>{member.role}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{capabilities.data && !capabilities.data.passwordReset ? (
				<Card>
					<CardHeader>
						<CardTitle>Recuperação de senha desligada</CardTitle>
						<CardDescription>
							RESEND_API_KEY e RESEND_FROM não estão definidos. Ninguém recupera a
							senha sozinho. Um administrador precisa redefinir.
						</CardDescription>
					</CardHeader>
				</Card>
			) : null}
		</div>
	);
}
