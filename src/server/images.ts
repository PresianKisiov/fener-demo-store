/**
 * Product photos. The bytes live in the product_images table; pages only ever read
 * the small metadata (id, size) and the browser loads the bytes from /api/images/{id}.
 */
import "server-only";
import { and, asc, eq, gt, inArray, lt, sql, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productImages, products } from "@/db/schema";

export type ImageMeta = { id: number; productId: number; position: number; width: number; height: number };

const META = {
  id: productImages.id,
  productId: productImages.productId,
  position: productImages.position,
  width: productImages.width,
  height: productImages.height,
};

export async function imagesFor(productIds: number[]): Promise<Map<number, ImageMeta[]>> {
  const map = new Map<number, ImageMeta[]>();
  if (productIds.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select(META)
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(asc(productImages.position), asc(productImages.id));
  for (const row of rows) map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
  return map;
}

export async function imageData(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ data: productImages.data, contentType: productImages.contentType, published: products.isPublished })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(eq(productImages.id, id));
  return row ?? null;
}

/** Checks the first bytes of the file, not only what the browser claims the type is. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const MAX_IMAGE_BYTES = 2_500_000;
export const MAX_IMAGES_PER_PRODUCT = 8;

export async function addImage(productId: number, bytes: Uint8Array, width: number, height: number) {
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new Error("Файлът не е снимка (JPEG, PNG или WebP).");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Снимката е над 2,5 MB след компресиране.");
  const db = await getDb();
  const [{ count, last }] = await db
    .select({ count: sql<number>`count(*)::int`, last: sql<number>`coalesce(max(${productImages.position}), -1)::int` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  if (count >= MAX_IMAGES_PER_PRODUCT) throw new Error(`Най-много ${MAX_IMAGES_PER_PRODUCT} снимки на продукт.`);
  const [row] = await db
    .insert(productImages)
    .values({ productId, position: last + 1, contentType, data: bytes, width, height, sizeBytes: bytes.length })
    .returning({ id: productImages.id });
  return row.id;
}

export async function deleteImage(id: number) {
  const db = await getDb();
  await db.delete(productImages).where(eq(productImages.id, id));
}

/** Swaps the photo with its neighbour. The first photo is the one shown in the catalog. */
export async function moveImage(id: number, direction: "up" | "down") {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [image] = await tx.select(META).from(productImages).where(eq(productImages.id, id));
    if (!image) return;
    const [neighbour] = await tx
      .select(META)
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, image.productId),
          direction === "up" ? lt(productImages.position, image.position) : gt(productImages.position, image.position),
        ),
      )
      .orderBy(direction === "up" ? desc(productImages.position) : asc(productImages.position))
      .limit(1);
    if (!neighbour) return;
    await tx.update(productImages).set({ position: neighbour.position }).where(eq(productImages.id, image.id));
    await tx.update(productImages).set({ position: image.position }).where(eq(productImages.id, neighbour.id));
  });
}
