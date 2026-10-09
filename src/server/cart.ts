/**
 * The cart lives in the database. The browser only keeps a random cart id in
 * an httpOnly cookie, so prices and quantities cannot be edited in the browser.
 */
import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cartItems, carts, products } from "@/db/schema";

const CART_COOKIE = "cart_id";
const UUID_RE = /^[0-9a-f-]{36}$/i;

async function readCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  return id && UUID_RE.test(id) ? id : null;
}

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  illustration: string;
  unitPriceCents: number;
  vatRate: number;
  quantity: number;
  stock: number;
};

export async function getCartLines(): Promise<CartLine[]> {
  const cartId = await readCartId();
  if (!cartId) return [];
  const db = await getDb();
  return db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      illustration: products.illustration,
      unitPriceCents: products.priceCents,
      vatRate: products.vatRate,
      quantity: cartItems.quantity,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(and(eq(cartItems.cartId, cartId), eq(products.isPublished, true)))
    .orderBy(asc(products.id));
}

export async function getCartCount(): Promise<number> {
  const cartId = await readCartId();
  if (!cartId) return 0;
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row?.total ?? 0;
}

/** Only call from a Server Action: it may set a cookie. */
async function getOrCreateCartId(): Promise<string> {
  const db = await getDb();
  const existing = await readCartId();
  if (existing) {
    const [found] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, existing));
    if (found) return found.id;
  }
  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  (await cookies()).set(CART_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return created.id;
}

/** Sets the quantity of a product in the cart (0 removes it). Capped by stock. */
export async function setCartQuantity(productId: number, quantity: number, mode: "add" | "set") {
  const db = await getDb();
  const [product] = await db
    .select({ stock: products.stock, isPublished: products.isPublished })
    .from(products)
    .where(eq(products.id, productId));
  if (!product || !product.isPublished) return;

  const cartId = await getOrCreateCartId();
  const [current] = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  const wanted = mode === "add" ? (current?.quantity ?? 0) + quantity : quantity;
  const next = Math.max(0, Math.min(wanted, product.stock));

  if (next === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  } else if (current) {
    await db
      .update(cartItems)
      .set({ quantity: next })
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  } else {
    await db.insert(cartItems).values({ cartId, productId, quantity: next });
  }
}

export async function clearCart() {
  const cartId = await readCartId();
  if (!cartId) return;
  const db = await getDb();
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
