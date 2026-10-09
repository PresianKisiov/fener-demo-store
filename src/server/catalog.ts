/**
 * Reading products for the shop. Only published products are visible to customers.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { priceHistory, products } from "@/db/schema";

export async function getPublishedProducts() {
  const db = await getDb();
  return db.select().from(products).where(eq(products.isPublished, true)).orderBy(asc(products.id));
}

export async function getPublishedProduct(slug: string) {
  const db = await getDb();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isPublished, true)));
  return product ?? null;
}

export async function getPriceHistory(productId: number) {
  const db = await getDb();
  return db.select().from(priceHistory).where(eq(priceHistory.productId, productId)).orderBy(asc(priceHistory.validFrom));
}
