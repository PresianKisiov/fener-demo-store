"use server";
/**
 * Placing an order. This is the most important function in the shop:
 * 1. Validate every field on the server (the browser checks are only for convenience).
 * 2. Read the cart from the database and recalculate prices there.
 * 3. Create the order in one transaction.
 * 4. Card: send the customer to the payment provider. Cash on delivery: show the thank-you page.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidPhoneNumber, parsePhoneNumberWithError } from "libphonenumber-js";
import { z } from "zod";
import { getBaseUrl } from "@/server/base-url";
import { clearCart, getCartLines } from "@/server/cart";
import { getOffice } from "@/server/couriers";
import { createOrder, OrderError } from "@/server/orders";
import { startCardPayment } from "@/server/payments";

const schema = z
  .object({
    customerName: z.string().trim().min(3, "Напиши име и фамилия.").max(120),
    phone: z
      .string()
      .trim()
      .refine((v) => isValidPhoneNumber(v, "BG"), "Провери телефона. Пример: 0888 123 456."),
    email: z.email({ error: "Провери имейла. Пример: ivan@abv.bg." }),
    courier: z.enum(["econt", "speedy"], { error: "Избери куриер." }),
    deliveryType: z.enum(["office", "locker", "address"], { error: "Избери как да ти доставим." }),
    officeId: z.string().optional(),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(200).optional(),
    paymentMethod: z.enum(["cod", "card"], { error: "Избери начин на плащане." }),
    terms: z.literal("on", { error: "За да поръчаш, приеми общите условия." }),
    marketing: z.literal("on").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryType === "address") {
      if (!v.city || v.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Напиши населеното място." });
      if (!v.address || v.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Напиши улица и номер." });
    } else if (!v.officeId) {
      ctx.addIssue({ code: "custom", path: ["officeId"], message: v.deliveryType === "locker" ? "Избери автомат." : "Избери офис." });
    }
  });

export type CheckoutState = {
  errors: Record<string, string>;
  formError?: string;
  values: Record<string, string>;
};

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors, values };
  }
  const data = parsed.data;

  let deliveryLabel: string;
  let city: string;
  let officeId: string | null = null;
  if (data.deliveryType === "address") {
    city = data.city!;
    deliveryLabel = `${data.address}, ${data.city}`;
  } else {
    const office = await getOffice(data.officeId!);
    if (!office || office.courier !== data.courier || office.kind !== data.deliveryType) {
      return { errors: { officeId: "Избраният офис не е от този куриер. Избери отново." }, values };
    }
    officeId = office.id;
    city = office.city;
    deliveryLabel = `${office.name}, ${office.address}, ${office.city}`;
  }

  // Quantities come from the database cart, never from the form.
  const cart = await getCartLines();
  const baseUrl = await getBaseUrl();

  let result;
  try {
    result = await createOrder(
      {
        customerName: data.customerName,
        phone: parsePhoneNumberWithError(data.phone, "BG").number,
        email: data.email.toLowerCase(),
        courier: data.courier,
        deliveryType: data.deliveryType,
        officeId,
        deliveryLabel,
        city,
        paymentMethod: data.paymentMethod,
        marketingConsent: data.marketing === "on",
        lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      },
      baseUrl,
    );
  } catch (error) {
    if (error instanceof OrderError) return { errors: {}, formError: error.message, values };
    throw error;
  }

  await clearCart();
  // The header (cart count) is in the shared layout; tell Next.js to render it again.
  revalidatePath("/", "layout");

  // redirect() works by throwing, so it stays outside try/catch.
  if (result.paymentId) {
    redirect(await startCardPayment(result.paymentId, result.order, baseUrl));
  }
  redirect(`/poruchka/blagodarim/${result.order.publicToken}`);
}
