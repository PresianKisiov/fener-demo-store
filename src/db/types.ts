/**
 * One database type for both drivers: PGlite on your computer and
 * postgres-js for a cloud Postgres (Neon, Supabase). Code that uses the
 * database only depends on this type, so it works the same with either.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
