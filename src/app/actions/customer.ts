"use server";
/**
 * Order tracking and the withdrawal function ("Отказ от договора").
 * Both require the order number AND the email, so a number alone reveals nothing.
 */
import { z } from "zod";
import { getDb } from "@/db/client";
import { orderItems, shipments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { formatDateTime } from "@/lib/dates";
import { ORDER_STATUS, type OrderStatus } from "@/lib/order-status";
import { COURIERS, type CourierId } from "@/lib/settings";
import { canWithdraw, findCustomerOrder, OrderError, requestWithdrawal } from "@/server/orders";

const lookupSchema = z.object({
  number: z.string().trim().min(4, "Напиши номера на поръчката, например 2026-000001."),
  email: z.email({ error: "Напиши имейла, с който поръча." }),
});

export type TrackState = {
  error?: string;
  values?: Record<string, string>;
  order?: {
    number: string;
    createdAt: string;
    status: string;
    courier: string;
    deliveryLabel: string;
    trackingNumber: string | null;
    courierStatus: string | null;
    events: { time: string; text: string; place: string | null }[];
    items: { name: string; quantity: number }[];
    canWithdraw: boolean;
  };
};

export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const values = { number: String(formData.get("number") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = lookupSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const order = await findCustomerOrder(parsed.data.number, parsed.data.email);
  if (!order) return { error: "Не намерихме поръчка с този номер и имейл. Провери ги в имейла с потвърждението.", values };

  const db = await getDb();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  // The last status we got from the courier (saved by "Провери статусите"), not a live call:
  // a customer refreshing the page must not hit the courier API every time.
  const [shipment] = await db
    .select()
    .from(shipments)
    .where(and(eq(shipments.orderId, order.id), isNull(shipments.cancelledAt)));
  return {
    values,
    order: {
      number: order.number,
      createdAt: formatDateTime(order.createdAt),
      status: ORDER_STATUS[order.status as OrderStatus],
      courier: COURIERS[order.courier as CourierId],
      deliveryLabel: order.deliveryLabel,
      trackingNumber: order.trackingNumber,
      courierStatus: shipment?.statusText ?? null,
      events: [...(shipment?.events ?? [])].reverse().map((e) => ({ ...e, time: formatDateTime(new Date(e.time)) })),
      items: items.map((i) => ({ name: i.productName, quantity: i.quantity })),
      canWithdraw: canWithdraw(order),
    },
  };
}

const withdrawalSchema = lookupSchema.extend({
  customerName: z.string().trim().min(3, "Напиши име и фамилия."),
  reason: z.string().trim().max(500).optional(),
});

export type WithdrawalState = { error?: string; done?: { number: string; requestedAt: string; email: string } };

export async function submitWithdrawalAction(_prev: WithdrawalState, formData: FormData): Promise<WithdrawalState> {
  const parsed = withdrawalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { order, requestedAt } = await requestWithdrawal({
      number: parsed.data.number,
      email: parsed.data.email,
      customerName: parsed.data.customerName,
      reason: parsed.data.reason || null,
    });
    return { done: { number: order.number, requestedAt: formatDateTime(requestedAt), email: parsed.data.email } };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    throw error;
  }
}
