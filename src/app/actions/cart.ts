"use server";
/**
 * Server Actions for the cart. A form in the browser calls these functions
 * directly; Next.js sends the form data to the server and re-renders the page.
 */
import { z } from "zod";
import { setCartQuantity } from "@/server/cart";

const lineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).max(99),
});

export type AddToCartState = { added: boolean; error?: string };

export async function addToCartAction(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.quantity < 1) return { added: false, error: "Избери количество от 1 до 99." };
  await setCartQuantity(parsed.data.productId, parsed.data.quantity, "add");
  return { added: true };
}

export async function updateCartQuantityAction(formData: FormData) {
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setCartQuantity(parsed.data.productId, parsed.data.quantity, "set");
}
