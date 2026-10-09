import path from "node:path";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { adminCredentials, ensureAdmin, seedIfEmpty } from "@/db/seed";
import type { DB } from "@/db/types";
import { verifyPassword } from "@/lib/password";

describe("database migrations and demo data", () => {
  it("creates the tables, seeds once and calculates the Omnibus prior price", async () => {
    const db = drizzle({ client: new PGlite("memory://"), schema }) as unknown as DB;
    await migrate(db as never, { migrationsFolder: path.resolve("src/db/migrations") });
    await seedIfEmpty(db);
    await seedIfEmpty(db); // second call must not duplicate anything

    const all = await db.select().from(schema.products);
    expect(all).toHaveLength(8);

    const [archive] = await db.select().from(schema.products).where(eq(schema.products.slug, "nastolna-lampa-arhiv"));
    expect(archive.priceCents).toBe(4490);
    // 59,90 was valid until 25 days ago, 54,90 after that: the lowest of the last 30 days is 54,90.
    expect(archive.priorPriceCents).toBe(5490);

    const offices = await db.select().from(schema.courierOffices);
    expect(offices.length).toBeGreaterThan(10);

    // Demo orders for the dashboard: totals must match their lines.
    const orders = await db.select().from(schema.orders);
    expect(orders.length).toBeGreaterThan(80);
    const items = await db.select().from(schema.orderItems);
    for (const o of orders) {
      const sum = items.filter((i) => i.orderId === o.id).reduce((s, i) => s + i.lineTotalCents, 0);
      expect(sum).toBe(o.subtotalCents);
      expect(o.totalCents).toBe(o.subtotalCents + o.shippingCents + o.codFeeCents);
      expect(o.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it("creates the admin with a hashed password and updates it when the password changes", async () => {
    const db = drizzle({ client: new PGlite("memory://"), schema }) as unknown as DB;
    await migrate(db as never, { migrationsFolder: path.resolve("src/db/migrations") });
    await ensureAdmin(db, { email: "boss@fener.test", password: "first-password" });
    await ensureAdmin(db, { email: "boss@fener.test", password: "second-password" });
    const admins = await db.select().from(schema.admins);
    expect(admins).toHaveLength(1);
    expect(await verifyPassword("second-password", admins[0].passwordHash)).toBe(true);
    expect(admins[0].passwordHash).not.toContain("second-password");
  });

  it("requires a strong admin password online", () => {
    const saved = { ...process.env };
    process.env.ADMIN_EMAIL = "a@b.bg";
    process.env.ADMIN_PASSWORD = "short";
    expect(() => adminCredentials(true)).toThrow();
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    expect(() => adminCredentials(true)).toThrow();
    expect(adminCredentials(false).email).toBe("admin@fener.test");
    process.env = saved;
  });
});
