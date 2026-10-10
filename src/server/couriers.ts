/**
 * Reading the office lists for the checkout. The lists themselves come from the
 * courier APIs (src/server/shipping) and are stored in courier_offices.
 *
 * The checkout first gets only the cities (small), then the offices of the chosen
 * city from /api/offices. Sending all ~600 Econt offices (and 1000+ from Speedy)
 * with every checkout page would make the page heavy on a phone.
 */
import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { courierOffices } from "@/db/schema";

export type OfficeCity = { courier: string; kind: string; city: string };

export async function listOfficeCities(): Promise<OfficeCity[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ courier: courierOffices.courier, kind: courierOffices.kind, city: courierOffices.city })
    .from(courierOffices);
  // Sorted here, with Bulgarian alphabet rules, not by the database (its sort order depends on the server's locale).
  return rows.sort((a, b) => a.city.localeCompare(b.city, "bg"));
}

export async function listOfficesInCity(courier: string, kind: string, city: string) {
  const db = await getDb();
  return db
    .select({ id: courierOffices.id, name: courierOffices.name, address: courierOffices.address, hours: courierOffices.hours })
    .from(courierOffices)
    .where(and(eq(courierOffices.courier, courier), eq(courierOffices.kind, kind), eq(courierOffices.city, city)))
    .orderBy(asc(courierOffices.name))
    .limit(200);
}

export async function getOffice(id: string) {
  const db = await getDb();
  const [office] = await db.select().from(courierOffices).where(eq(courierOffices.id, id));
  return office ?? null;
}

export async function officeStats() {
  const db = await getDb();
  return db
    .select({
      courier: courierOffices.courier,
      kind: courierOffices.kind,
      count: sql<number>`count(*)::int`,
      syncedAt: sql<string | null>`max(${courierOffices.syncedAt})`,
    })
    .from(courierOffices)
    .groupBy(courierOffices.courier, courierOffices.kind);
}
