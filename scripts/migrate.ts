/**
 * Runs before `next build` (see "build" in package.json).
 *
 * With DATABASE_URL (online): creates or updates the tables, adds the demo data
 * the first time, creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD and
 * refreshes the courier office lists.
 * Without DATABASE_URL (your computer): does nothing, PGlite does this on start.
 */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../src/db/schema";
import { adminCredentials, ensureAdmin, seedIfEmpty } from "../src/db/seed";
import type { DB } from "../src/db/types";
import { cleanDatabaseUrl } from "../src/db/url";
import { syncOfficesOnBuild } from "../src/db/build-sync";

async function main() {
  const url =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL || process.env.NETLIFY) {
      // Online there is no disk to keep a local database on, so a cloud Postgres is required.
      throw new Error(
        "Няма свързана база данни. Добави DATABASE_URL (връзката от Neon) в настройките на хостинга и пусни build отново.",
      );
    }
    console.log("[migrate] Няма DATABASE_URL: локалната база PGlite се създава при пускане. Пропускам.");
    return;
  }
  // Check the admin settings first, so a missing password stops the build with a clear message.
  const creds = adminCredentials(true);

  // Migrations need a direct connection; Neon gives it as DATABASE_URL_UNPOOLED.
  const client = postgres(cleanDatabaseUrl(process.env.DATABASE_URL_UNPOOLED || url), { max: 1, prepare: false, onnotice: () => {} });
  try {
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "db", "migrations") });
    console.log("[migrate] Таблиците са готови.");
    await seedIfEmpty(db as unknown as DB);
    await ensureAdmin(db as unknown as DB, creds);
    console.log(`[migrate] Демо данните и админът (${creds.email}) са готови.`);
    await syncOfficesOnBuild(db as unknown as DB, (m) => console.log(`[migrate] ${m}`));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migrate] Грешка:", error instanceof Error ? error.message : error);
  process.exit(1);
});
