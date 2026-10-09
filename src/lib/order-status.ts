/**
 * Order state machine. An order can only move along the arrows below.
 * The server checks every change against this map, so a bug or a double
 * click cannot, for example, mark a cancelled order as shipped.
 */
export const ORDER_STATUS = {
  pending_payment: "Чака плащане",
  pending_confirmation: "Чака потвърждение",
  payment_failed: "Неуспешно плащане",
  confirmed: "Потвърдена",
  packed: "Опакована",
  shipped: "Изпратена",
  delivered: "Доставена",
  refused: "Отказана при доставка",
  returned: "Върната в склада",
  cancelled: "Отказана от магазина",
  withdrawal_requested: "Заявен отказ от договора",
  withdrawal_received: "Върнатата стока е получена",
  refunded: "Парите са върнати",
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "payment_failed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  payment_failed: ["cancelled"],
  confirmed: ["packed", "cancelled", "withdrawal_requested"],
  packed: ["shipped", "cancelled", "withdrawal_requested"],
  shipped: ["delivered", "refused", "withdrawal_requested"],
  delivered: ["withdrawal_requested"],
  refused: ["returned"],
  returned: [],
  cancelled: [],
  withdrawal_requested: ["withdrawal_received", "refunded"],
  withdrawal_received: ["refunded"],
  refunded: [],
};

/** Transitions that only the system may make (payment provider, customer), not an admin button. */
const SYSTEM_ONLY: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["confirmed", "payment_failed"],
  confirmed: ["withdrawal_requested"],
  packed: ["withdrawal_requested"],
  shipped: ["withdrawal_requested"],
  delivered: ["withdrawal_requested"],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Status changes an admin can trigger with a button for an order in `from`. */
export function adminTransitions(from: OrderStatus): OrderStatus[] {
  const systemOnly = SYSTEM_ONLY[from] ?? [];
  return TRANSITIONS[from].filter((to) => !systemOnly.includes(to));
}

/** Statuses during which the customer may still use the withdrawal function. */
export const WITHDRAWABLE: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

/** Orders that count as sales in reports (not cancelled, failed, refused or returned). */
export const REVENUE_STATUSES: OrderStatus[] = ["pending_confirmation", "confirmed", "packed", "shipped", "delivered"];
