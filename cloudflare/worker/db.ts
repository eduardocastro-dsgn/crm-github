import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "~/prisma/client";
import type { Env } from "./env";

export type Db = PrismaClient;

export function createDb(env: Env): Db {
	return new PrismaClient({ adapter: new PrismaD1(env.DB) });
}
