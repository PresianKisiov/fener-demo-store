/**
 * Cleans a Postgres connection string before giving it to postgres.js.
 *
 * Neon adds "channel_binding=require" to its connection strings. That option is
 * understood by some drivers (libpq, psql) but postgres.js sends unknown options
 * to the server as settings, and Postgres answers
 * 'unrecognized configuration parameter "channel_binding"'. So we remove it.
 */
const DRIVER_ONLY_PARAMS = ["channel_binding"];

export function cleanDatabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  for (const name of DRIVER_ONLY_PARAMS) url.searchParams.delete(name);
  return url.toString();
}
