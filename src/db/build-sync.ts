/**
 * Runs during every online build (scripts/migrate.ts):
 * 1. Databases created before the courier integration have invented offices without
 *    a courier code; they are replaced with the demo list.
 * 2. Each courier that is not in mock mode gets a fresh office list from its API.
 *    A failure only prints a warning: the shop must deploy even if a courier API is down.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { getCourier } from "../server/shipping";
import { COURIERS, type CourierId } from "../lib/settings";
import { demoOfficeRows, replaceOffices } from "./offices";
import * as schema from "./schema";
import type { DB } from "./types";

export async function syncOfficesOnBuild(db: DB, log: (message: string) => void) {
  const [{ legacy }] = await db
    .select({ legacy: sql<number>`count(*)::int` })
    .from(schema.courierOffices)
    .where(eq(schema.courierOffices.code, ""));
  if (legacy > 0) {
    await db.transaction(async (tx) => {
      await tx.delete(schema.courierOffices).where(eq(schema.courierOffices.code, ""));
      await tx.insert(schema.courierOffices).values(demoOfficeRows()).onConflictDoNothing();
    });
    log(`Старите демо офиси (${legacy}) са заменени с офиси с кодове.`);

    // Open demo orders pointed at the old invented offices; move them to a real demo office
    // of the same courier and type (same city when there is one), so a waybill can be created.
    const offices = demoOfficeRows();
    const open = await db
      .select()
      .from(schema.orders)
      .where(inArray(schema.orders.status, ["pending_confirmation", "pending_payment", "confirmed", "packed"]));
    let moved = 0;
    for (const order of open) {
      if (!order.officeId || !/^(econt|speedy)-\d{3}$/.test(order.officeId)) continue;
      const same = offices.filter((o) => o.courier === order.courier && o.kind === order.deliveryType);
      const office = same.find((o) => o.city === order.city) ?? same[0];
      if (!office) continue;
      await db
        .update(schema.orders)
        .set({ officeId: office.id, city: office.city, deliveryLabel: `${office.name}, ${office.address}, ${office.city}` })
        .where(eq(schema.orders.id, order.id));
      moved++;
    }
    if (moved) log(`${moved} отворени демо поръчки са насочени към офиси с кодове.`);
  }

  for (const courier of Object.keys(COURIERS) as CourierId[]) {
    try {
      const adapter = getCourier(courier);
      if (adapter.mode === "mock") continue;
      const count = await replaceOffices(db, courier, await adapter.fetchOffices());
      log(`${COURIERS[courier]}: ${count} офиса и автомата от API (${adapter.mode}).`);
    } catch (error) {
      log(`ВНИМАНИЕ: офисите на ${COURIERS[courier]} не се обновиха: ${error instanceof Error ? error.message : error}`);
    }
  }
}
