export function searchKey(value: string | null | undefined): string {
	if (!value) return "";

	return value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

export function optionalSearchKey(
	value: string | null | undefined,
): string | null {
	const key = searchKey(value);
	return key === "" ? null : key;
}

export function personSearchKey(
	firstName: string,
	lastName: string | null | undefined,
): string {
	return searchKey([firstName, lastName].filter(Boolean).join(" "));
}
