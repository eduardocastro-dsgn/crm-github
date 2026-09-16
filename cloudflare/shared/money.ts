import { z } from "zod";

declare const centsBrand: unique symbol;
declare const scaledRateBrand: unique symbol;

export type Cents = number & { readonly [centsBrand]: true };
export type ScaledRate = number & { readonly [scaledRateBrand]: true };

export const RATE_SCALE = 10_000_000_000;

export const MAX_CENTS = 999_999_999_999;

export const cents = z
	.number()
	.int()
	.min(-MAX_CENTS)
	.max(MAX_CENTS)
	.transform((value) => value as Cents);

export const scaledRate = z
	.number()
	.int()
	.positive()
	.transform((value) => value as ScaledRate);

export function toCents(value: number): Cents {
	return Math.round(value * 100) as Cents;
}

export function fromCents(value: Cents): number {
	return value / 100;
}

export function toScaledRate(value: number): ScaledRate {
	return Math.round(value * RATE_SCALE) as ScaledRate;
}

export function fromScaledRate(value: ScaledRate): number {
	return value / RATE_SCALE;
}

export function convert(amount: Cents, rate: ScaledRate): Cents {
	return Math.round((amount * rate) / RATE_SCALE) as Cents;
}

export function sumCents(values: readonly (Cents | null)[]): Cents {
	let total = 0;
	for (const value of values) if (value !== null) total += value;
	return total as Cents;
}

export const SUPPORTED_CURRENCIES = [
	"BRL",
	"USD",
	"EUR",
	"GBP",
	"ARS",
	"CLP",
	"MXN",
] as const;

export const currencyCode = z.enum(SUPPORTED_CURRENCIES);
export type CurrencyCode = z.infer<typeof currencyCode>;

export function formatCents(
	value: Cents | null,
	currency: string,
	locale = "pt-BR",
): string {
	if (value === null) return "—";

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
	}).format(fromCents(value));
}
