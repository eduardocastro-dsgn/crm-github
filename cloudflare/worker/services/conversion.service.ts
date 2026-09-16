import type { Cents, ScaledRate } from "~/shared/money";
import { convert, toScaledRate } from "~/shared/money";
import { WORKSPACE_ID } from "~/shared/workspace";
import type { Db } from "../db";

export type DealMoney = {
	amount: Cents | null;
	currency: string;
	baseAmount: Cents | null;
	baseCurrency: string | null;
	fxRate: ScaledRate | null;
	fxRateAt: Date | null;
};

export async function reportingCurrencyOf(
	db: Db,
	fallback: string,
): Promise<string> {
	const setting = await db.appSetting.findUnique({
		where: { id: WORKSPACE_ID },
		select: { reportingCurrency: true },
	});

	return setting?.reportingCurrency ?? fallback;
}

export async function resolveRate(
	db: Db,
	base: string,
	quote: string,
): Promise<ScaledRate | null> {
	if (base === quote) return toScaledRate(1);

	const rows = await db.exchangeRate.findMany({
		where: { baseCurrency: base, quoteCurrency: quote },
		select: { rate: true, source: true },
	});

	const manual = rows.find((row) => row.source === "MANUAL");
	const chosen = manual ?? rows[0];

	if (!chosen || chosen.rate <= 0) return null;

	return chosen.rate as ScaledRate;
}

export async function dealMoney(
	db: Db,
	amount: Cents | null,
	currency: string,
	fallbackCurrency: string,
): Promise<DealMoney> {
	const base = await reportingCurrencyOf(db, fallbackCurrency);

	if (amount === null) {
		return {
			amount: null,
			currency,
			baseAmount: null,
			baseCurrency: base,
			fxRate: null,
			fxRateAt: null,
		};
	}

	const rate = await resolveRate(db, base, currency);

	if (rate === null) {
		return {
			amount,
			currency,
			baseAmount: null,
			baseCurrency: base,
			fxRate: null,
			fxRateAt: null,
		};
	}

	return {
		amount,
		currency,
		baseAmount: convert(amount, rate),
		baseCurrency: base,
		fxRate: rate,
		fxRateAt: new Date(),
	};
}

export function countedWhere(base: string) {
	return { baseAmount: { not: null }, baseCurrency: base };
}

export function pendingWhere(base: string) {
	return {
		OR: [
			{ baseAmount: null },
			{ baseCurrency: null },
			{ baseCurrency: { not: base } },
		],
	};
}
