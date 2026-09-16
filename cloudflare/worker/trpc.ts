import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Db } from "./db";
import type { Env } from "./env";

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
};

export type Context = {
	db: Db;
	env: Env;
	user: SessionUser | null;
	role: string | null;
};

const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zod:
					error.cause instanceof ZodError
						? error.cause.flatten().fieldErrors
						: null,
			},
		};
	},
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre para continuar." });
	}

	return next({ ctx: { ...ctx, user: ctx.user } });
});

export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.role !== "owner" && ctx.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Só um administrador do workspace faz isso.",
		});
	}

	return next({ ctx });
});
