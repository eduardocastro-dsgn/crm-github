import { SUPPORTED_CURRENCIES, toScaledRate } from "~/shared/money";
import { WORKSPACE_ID } from "~/shared/workspace";
import type { Db } from "../db";
import { type Env, reportingCurrency } from "../env";
import { reportingCurrencyOf } from "./conversion.service";

const FEED = "https://api.frankfurter.dev/v1/latest";

type FeedResponse = { base: string; date: string; rates: Record<string, number> };

export async function refreshRates(db: Db, env: Env): Promise<number> {
	const base = await reportingCurrencyOf(db, reportingCurrency(env));

	const quotes = SUPPORTED_CURRENCIES.filter((code) => code !== base);

	if (quotes.length === 0) return 0;

	const url = `${FEED}?base=${base}&symbols=${quotes.join(",")}`;

	let payload: FeedResponse;

	try {
		const response = await fetch(url, {
			headers: { accept: "application/json" },
		});

		if (!response.ok) {
			console.log({ message: "Feed de câmbio recusou", status: response.status });
			return 0;
		}

		payload = (await response.json()) as FeedResponse;
	} catch (error) {
		console.log({
			message: "Feed de câmbio inacessível",
			reason: error instanceof Error ? error.message : "desconhecido",
		});
		return 0;
	}

	const asOf = new Date(payload.date);
	let written = 0;

	for (const [quote, quoted] of Object.entries(payload.rates ?? {})) {
		if (!Number.isFinite(quoted) || quoted <= 0) continue;

		const rate = toScaledRate(1 / quoted);

		await db.exchangeRate.upsert({
			where: {
				baseCurrency_quoteCurrency_source: {
					baseCurrency: base,
					quoteCurrency: quote,
					source: "FETCHED",
				},
			},
			create: {
				baseCurrency: base,
				quoteCurrency: quote,
				rate,
				asOf,
				source: "FETCHED",
				provider: "frankfurter",
			},
			update: { rate, asOf, provider: "frankfurter" },
		});

		written += 1;
	}

	await db.appSetting.upsert({
		where: { id: WORKSPACE_ID },
		create: { id: WORKSPACE_ID, ratesRefreshedAt: new Date() },
		update: { ratesRefreshedAt: new Date() },
	});

	return written;
}
