import { describe, expect, it } from "vitest";
import {
	optionalSearchKey,
	personSearchKey,
	searchKey,
} from "~/shared/search-key";

describe("searchKey", () => {
	it("tira acento e baixa a caixa", () => {
		expect(searchKey("José")).toBe("jose");
		expect(searchKey("AÇÃO")).toBe("acao");
		expect(searchKey("Conceição Ltda")).toBe("conceicao ltda");
	});

	it("faz José e jose colidirem na mesma chave", () => {
		expect(searchKey("José")).toBe(searchKey("jose"));
		expect(searchKey("JOSÉ")).toBe(searchKey("josé"));
	});

	it("colapsa espaço e apara as pontas", () => {
		expect(searchKey("  Maria   da   Silva  ")).toBe("maria da silva");
	});

	it("devolve texto vazio para nulo", () => {
		expect(searchKey(null)).toBe("");
		expect(searchKey(undefined)).toBe("");
	});

	it("optionalSearchKey devolve nulo quando vazio", () => {
		expect(optionalSearchKey("")).toBeNull();
		expect(optionalSearchKey("   ")).toBeNull();
		expect(optionalSearchKey("Açaí")).toBe("acai");
	});

	it("personSearchKey junta nome e sobrenome", () => {
		expect(personSearchKey("João", "Gonçalves")).toBe("joao goncalves");
		expect(personSearchKey("João", null)).toBe("joao");
	});
});
