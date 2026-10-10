/**
 * Writes a courier's office list into courier_offices.
 * Used by the admin "Обнови офисите" button and by the online build (scripts/migrate.ts).
 */
import { eq } from "drizzle-orm";
import type { SyncedOffice } from "../server/shipping/types";
import { DEMO_OFFICES } from "./demo-offices";
import * as schema from "./schema";
import type { DB } from "./types";

export function officeRow(courier: string, o: SyncedOffice, syncedAt: Date | null) {
  return {
    id: `${courier}-${o.code}`,
    courier,
    code: o.code,
    kind: o.kind,
    city: o.city,
    postCode: o.postCode,
    name: o.name,
    address: o.address,
    hours: o.hours,
    syncedAt,
  };
}

/**
 * Replaces all offices of one courier in one transaction: customers never see
 * a half-empty list. An empty answer from the courier is treated as an error,
 * so a broken API response cannot wipe the list.
 */
export async function replaceOffices(db: DB, courier: string, offices: SyncedOffice[], syncedAt = new Date()) {
  if (offices.length === 0) throw new Error("Куриерът върна празен списък с офиси. Старият списък е запазен.");
  // The same code twice would break the primary key; keep the first one.
  const unique = [...new Map(offices.map((o) => [o.code, o])).values()];
  await db.transaction(async (tx) => {
    await tx.delete(schema.courierOffices).where(eq(schema.courierOffices.courier, courier));
    for (let i = 0; i < unique.length; i += 400) {
      await tx.insert(schema.courierOffices).values(unique.slice(i, i + 400).map((o) => officeRow(courier, o, syncedAt)));
    }
  });
  return unique.length;
}

export function demoOfficeRows() {
  return DEMO_OFFICES.map(({ courier, ...o }) => officeRow(courier, o, null));
}
