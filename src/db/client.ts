/**
 * Database connection. Two modes, same code everywhere else:
 *
 * 1. No DATABASE_URL (your computer): PGlite, a real PostgreSQL that runs inside
 *    Node.js and keeps its files in ./.data/pglite. Tables and demo data are
 *    created automatically on the first start.
 *
 * 2. DATABASE_URL is set (online, e.g. Vercel + Neon): a normal Postgres
 *    connection with postgres-js. Tables and demo data are created during the
 *    build by scripts/migrate.ts, not here, because online many copies of the
 *    app may start at the same moment.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { adminCredentials, ensureAdmin, seedIfEmpty } from "./seed";
import type { DB } from "./types";
import { cleanDatabaseUrl } from "./url";

export type { DB, Tx } from "./types";

// Next.js reloads modules during development. Keeping the connection on
// globalThis makes sure only one connection (or one PGlite) is ever opened.
const globalForDb = globalThis as unknown as { fenerDb?: Promise<DB> };

export function databaseUrl(): string | undefined {
  // DATABASE_URL is what you set yourself; the others are names that Vercel and Netlify use for their databases.
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NETLIFY_DB_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    undefined
  );
}

async function connectPostgres(url: string): Promise<DB> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // prepare: false is required by connection poolers such as Neon's and Supabase's.
  const client = postgres(cleanDatabaseUrl(url), { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5), onnotice: () => {} });
  return drizzle({ client, schema }) as unknown as DB;
}

async function connectPglite(): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (!dataDir.startsWith("memory://")) fs.mkdirSync(dataDir, { recursive: true });
  const db = drizzle({ client: new PGlite(dataDir), schema });
  // Creates or updates the tables from src/db/migrations. Already applied migrations are skipped.
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "db", "migrations") });
  const typed = db as unknown as DB;
  await seedIfEmpty(typed);
  await ensureAdmin(typed, adminCredentials(false));
  return typed;
}

export function getDb(): Promise<DB> {
  const url = databaseUrl();
  globalForDb.fenerDb ??= (url ? connectPostgres(url) : connectPglite()).catch((error) => {
    globalForDb.fenerDb = undefined;
    throw error;
  });
  return globalForDb.fenerDb;
}
