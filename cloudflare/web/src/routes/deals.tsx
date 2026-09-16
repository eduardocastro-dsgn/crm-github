import { Badge } from "@crm/ui/components/badge";
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
import { DEAL_STAGE_LABELS, type DealStage } from "~/shared/enums";
import { type Cents, formatCents, toCents } from "~/shared/money";
import { PageHeader } from "../components/page-header";
import { formatDate } from "../lib/format";
import { useSession } from "../lib/auth-client";
import { useTRPC } from "../lib/trpc";

export function DealsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const [search, setSearch] = useState("");
	const [open, setOpen] = useState(false);

	const list = useQuery(
		trpc.deals.list.queryOptions({
			search: search || undefined,
			archived: false,
			direction: "desc",
			take: 50,
		}),
	);

	const pipeline = useQuery(trpc.deals.pipeline.queryOptions());

	const companies = useQuery(
		trpc.companies.list.queryOptions({
			archived: false,
			direction: "asc",
			sort: "name",
			take: 200,
		}),
	);

	const create = useMutation(
		trpc.deals.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.deals.list.pathKey() });
				queryClient.invalidateQueries({
					queryKey: trpc.deals.pipeline.pathKey(),
				});
				setOpen(false);
				toast.success("Negócio criado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const move = useMutation(
		trpc.deals.moveStage.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.deals.list.pathKey() });
				queryClient.invalidateQueries({
					queryKey: trpc.deals.pipeline.pathKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!session) return;

		const form = new FormData(event.currentTarget);
		const amount = Number(form.get("amount") ?? 0);

		create.mutate({
			name: String(form.get("name") ?? ""),
			companyId: String(form.get("companyId") ?? ""),
			ownerId: session.user.id,
			stage: String(form.get("stage") ?? "DEMO_BOOKED") as DealStage,
			amount: Number.isFinite(amount) && amount > 0 ? toCents(amount) : null,
			currency: "BRL",
		});
	}

	return (
		<>
			<PageHeader
				title="Negócios"
				search={search}
				onSearch={setSearch}
				action={
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button>Novo negócio</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Novo negócio</DialogTitle>
							</DialogHeader>
							<form className="flex flex-col gap-6" onSubmit={submit}>
								<div className="flex flex-col gap-2">
									<Label htmlFor="name">Nome</Label>
									<Input id="name" name="name" required />
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="companyId">Empresa</Label>
									<select id="companyId" name="companyId" required>
										{companies.data?.rows.map((row) => (
											<option key={row.id} value={row.id}>
												{row.name}
											</option>
										))}
									</select>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="stage">Etapa</Label>
									<select id="stage" name="stage" defaultValue="DEMO_BOOKED">
										{Object.entries(DEAL_STAGE_LABELS).map(([value, label]) => (
											<option key={value} value={value}>
												{label}
											</option>
										))}
									</select>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="amount">Valor em reais</Label>
									<Input id="amount" name="amount" type="number" step="0.01" min="0" />
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

			{pipeline.data ? (
				<div className="flex flex-wrap gap-3 pb-6">
					{pipeline.data.stages.map((stage) => (
						<div key={stage.stage} className="rounded-lg border p-4">
							<p className="text-muted-foreground text-sm">
								{DEAL_STAGE_LABELS[stage.stage]}
							</p>
							<p className="font-medium">
								{formatCents(stage.total as Cents, pipeline.data.base)}
							</p>
							<p className="text-muted-foreground text-sm">
								{stage.counted} de {stage.count} convertidos
							</p>
						</div>
					))}
				</div>
			) : null}

			{list.data && list.data.unconverted > 0 ? (
				<p className="pb-4 text-muted-foreground text-sm">
					{list.data.unconverted} negócios não entram nos totais. Falta taxa de
					câmbio.
				</p>
			) : null}

			{list.isPending ? <Spinner /> : null}

			{list.data && list.data.rows.length === 0 ? (
				<Empty>Nenhum negócio encontrado.</Empty>
			) : null}

			{list.data && list.data.rows.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Nome</TableHead>
							<TableHead>Empresa</TableHead>
							<TableHead>Etapa</TableHead>
							<TableHead>Valor</TableHead>
							<TableHead>Fechamento</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.data.rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell>{row.name}</TableCell>
								<TableCell>{row.company.name}</TableCell>
								<TableCell>
									<select
										value={row.stage}
										disabled={move.isPending}
										onChange={(event) =>
											move.mutate({
												id: row.id,
												version: row.version,
												stage: event.target.value as DealStage,
											})
										}
									>
										{Object.entries(DEAL_STAGE_LABELS).map(([value, label]) => (
											<option key={value} value={value}>
												{label}
											</option>
										))}
									</select>
								</TableCell>
								<TableCell>
									{formatCents(row.amount as Cents | null, row.currency)}
								</TableCell>
								<TableCell>{formatDate(row.expectedCloseDate)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : null}
		</>
	);
}
