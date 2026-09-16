import { describe, expect, it } from "vitest";
import {
	type Cents,
	convert,
	formatCents,
	fromCents,
	fromScaledRate,
	RATE_SCALE,
	type ScaledRate,
	sumCents,
	toCents,
	toScaledRate,
} from "~/shared/money";

describe("centavos", () => {
	it("converte reais para centavos sem erro de ponto flutuante", () => {
		expect(toCents(19.99)).toBe(1999);
		expect(toCents(0.1 + 0.2)).toBe(30);
		expect(toCents(1250)).toBe(125_000);
	});

	it("volta de centavos para reais", () => {
		expect(fromCents(1999 as Cents)).toBe(19.99);
	});

	it("soma ignorando nulos", () => {
		expect(sumCents([100, null, 250] as (Cents | null)[])).toBe(350);
		expect(sumCents([])).toBe(0);
	});
});

describe("taxa escalada", () => {
	it("mantém a escala de dez casas", () => {
		expect(toScaledRate(1)).toBe(RATE_SCALE);
		expect(fromScaledRate(toScaledRate(5.4321))).toBeCloseTo(5.4321, 9);
	});

	it("converte valor pela taxa", () => {
		const amount = 10_000 as Cents;
		const rate = toScaledRate(5.5);

		expect(convert(amount, rate)).toBe(55_000);
	});

	it("taxa de um não muda o valor", () => {
		const amount = 123_456 as Cents;

		expect(convert(amount, toScaledRate(1))).toBe(123_456);
	});

	it("ida e volta perde no máximo um centavo", () => {
		const amount = 987_654 as Cents;
		const rate = toScaledRate(5.4321);
		const back = toScaledRate(1 / 5.4321);

		const round = convert(convert(amount, rate) as Cents, back);

		expect(Math.abs(round - amount)).toBeLessThanOrEqual(1);
	});
});

describe("formatCents", () => {
	it("mostra travessão para nulo", () => {
		expect(formatCents(null, "BRL")).toBe("—");
	});

	it("formata em real", () => {
		expect(formatCents(125_000 as Cents, "BRL")).toContain("1.250,00");
	});
});
