"use server";
/**
 * Admin buttons for couriers. Like every admin action, each one starts with requireAdmin().
 * The work itself is in src/server/shipping/service.ts.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COURIERS, type CourierId } from "@/lib/settings";
import { requireAdmin } from "@/server/auth";
import { OrderError } from "@/server/orders";
import { CourierError } from "@/server/shipping";
import { cancelShipment, createShipmentForOrder, refreshTracking, syncOffices } from "@/server/shipping/service";

export type ShippingActionState = { error?: string; message?: string };

/** Errors the admin can act on are shown; anything else is a bug and goes to the server log. */
function readable(error: unknown): ShippingActionState {
  if (error instanceof OrderError || error instanceof CourierError) return { error: error.message };
  throw error;
}

const parcelSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  weightKg: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= 0.1 && v <= 50, "Теглото е между 0,1 и 50 кг."),
  description: z.string().trim().min(2, "Напиши какво има в пратката, например „Лампи“.").max(50),
});

export async function createShipmentAction(_prev: ShippingActionState, formData: FormData): Promise<ShippingActionState> {
  await requireAdmin();
  const parsed = parcelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orderId, weightKg, description } = parsed.data;
  try {
    const shipment = await createShipmentForOrder(orderId, { weightGrams: Math.round(weightKg * 1000), description }, "admin");
    revalidatePath("/admin", "layout");
    return { message: `Товарителница ${shipment.trackingNumber} е създадена.` };
  } catch (error) {
    return readable(error);
  }
}

export async function cancelShipmentAction(_prev: ShippingActionState, formData: FormData): Promise<ShippingActionState> {
  await requireAdmin();
  const orderId = Number(formData.get("orderId"));
  try {
    await cancelShipment(orderId, "admin");
    revalidatePath("/admin", "layout");
    return { message: "Товарителницата е анулирана." };
  } catch (error) {
    return readable(error);
  }
}

export async function refreshTrackingAction(_prev: ShippingActionState, formData: FormData): Promise<ShippingActionState> {
  await requireAdmin();
  const orderId = formData.get("orderId") ? Number(formData.get("orderId")) : undefined;
  try {
    const summary = await refreshTracking("courier", orderId);
    revalidatePath("/admin", "layout");
    const parts = [`Проверени пратки: ${summary.checked}.`];
    parts.push(summary.changedOrders.length ? `Сменени поръчки: ${summary.changedOrders.join(", ")}.` : "Няма промени в поръчките.");
    if (summary.errors.length) return { error: [...parts, ...summary.errors].join(" ") };
    return { message: parts.join(" ") };
  } catch (error) {
    return readable(error);
  }
}

export async function syncOfficesAction(_prev: ShippingActionState, formData: FormData): Promise<ShippingActionState> {
  await requireAdmin();
  const courier = String(formData.get("courier")) as CourierId;
  if (!(courier in COURIERS)) return { error: "Непознат куриер." };
  try {
    const count = await syncOffices(courier);
    revalidatePath("/admin/kurieri");
    return { message: `${COURIERS[courier]}: записани ${count} офиса и автомата.` };
  } catch (error) {
    return readable(error);
  }
}
