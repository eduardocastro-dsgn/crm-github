export type Statement = { sql: string; params: unknown[] };

export function sql(strings: TemplateStringsArray, ...params: unknown[]): Statement {
	return { sql: strings.join("?"), params };
}

export async function batch(
	d1: D1Database,
	statements: readonly Statement[],
): Promise<void> {
	if (statements.length === 0) return;

	const prepared = statements.map((statement) =>
		d1.prepare(statement.sql).bind(...(statement.params as never[])),
	);

	await d1.batch(prepared);
}
