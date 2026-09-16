import { staleWrite } from "../errors";

export async function retryOnConflict<T>(
	attempt: () => Promise<T | null>,
): Promise<T> {
	const first = await attempt();
	if (first !== null) return first;

	const second = await attempt();
	if (second !== null) return second;

	staleWrite();
}

export type Versioned = { version: number };

export function nextVersion(row: Versioned): number {
	return row.version + 1;
}
