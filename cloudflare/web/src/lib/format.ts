export function formatDate(value: string | Date | null): string {
	if (value === null) return "—";

	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

export function initials(name: string): string {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function fullName(
	firstName: string,
	lastName: string | null,
): string {
	return [firstName, lastName].filter(Boolean).join(" ");
}
