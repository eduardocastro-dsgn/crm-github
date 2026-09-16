import { Input } from "@crm/ui/components/input";
import type { ReactNode } from "react";

export function PageHeader({
	title,
	search,
	onSearch,
	action,
}: {
	title: string;
	search: string;
	onSearch: (value: string) => void;
	action: ReactNode;
}) {
	return (
		<div className="flex items-center gap-4 pb-6">
			<h1 className="font-medium text-lg">{title}</h1>

			<Input
				className="max-w-xs"
				placeholder="Buscar"
				value={search}
				onChange={(event) => onSearch(event.target.value)}
			/>

			<div className="ml-auto">{action}</div>
		</div>
	);
}
