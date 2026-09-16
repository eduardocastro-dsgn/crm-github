import { TRPCError } from "@trpc/server";

const PRISMA_NOT_FOUND = "P2025";
const PRISMA_UNIQUE = "P2002";
const PRISMA_FK = "P2003";

type PrismaError = { code?: unknown; meta?: unknown };

export function translate(error: unknown): never {
	if (error instanceof TRPCError) throw error;

	const code = (error as PrismaError)?.code;

	if (code === PRISMA_NOT_FOUND) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Registro não existe." });
	}

	if (code === PRISMA_UNIQUE) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Já existe um registro com esse valor.",
		});
	}

	if (code === PRISMA_FK) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "O registro referenciado não existe.",
		});
	}

	throw error;
}

export function notFound(what: string): never {
	throw new TRPCError({ code: "NOT_FOUND", message: `${what} não existe.` });
}

export function conflict(message: string): never {
	throw new TRPCError({ code: "CONFLICT", message });
}

export function forbidden(message: string): never {
	throw new TRPCError({ code: "FORBIDDEN", message });
}

export function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const STALE_WRITE =
	"O registro mudou enquanto você editava. Recarregue e tente de novo.";

export function staleWrite(): never {
	throw new TRPCError({ code: "CONFLICT", message: STALE_WRITE });
}
