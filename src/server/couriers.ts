/**
 * Couriers. The demo uses its own office list (seeded in the database) and invents
 * tracking numbers. A real integration replaces two things here:
 * - listOffices(): sync the office list daily from the Econt / Speedy API into courier_offices
 * - createTrackingNumber(): call the courier API to create a waybill and return its number
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { courierOffices } from "@/db/schema";
import type { CourierId } from "@/lib/settings";

export async function listOffices() {
  const db = await getDb();
  return db.select().from(courierOffices).orderBy(asc(courierOffices.city), asc(courierOffices.name));
}

export async function getOffice(id: string) {
  const db = await getDb();
  const [office] = await db.select().from(courierOffices).where(eq(courierOffices.id, id));
  return office ?? null;
}

export function createTrackingNumber(courier: CourierId): string {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b % 10).join("");
  return `${courier === "econt" ? "EC" : "SP"}${digits}`;
}
