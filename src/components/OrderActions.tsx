"use client";
import { useActionState } from "react";
import { changeOrderStatusAction, type OrderActionState } from "@/app/actions/admin";
import type { OrderStatus } from "@/lib/order-status";
import { SubmitButton } from "./SubmitButton";

const LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Потвърди поръчката",
  packed: "Маркирай като опакована",
  shipped: "Предадена на куриера",
  delivered: "Маркирай като доставена",
  refused: "Клиентът не прие пратката",
  returned: "Пратката се върна в склада",
  withdrawal_received: "Върнатата стока е получена",
  refunded: "Парите са върнати",
  cancelled: "Откажи поръчката",
};

export function OrderActions({ orderId, from, allowed }: { orderId: number; from: string; allowed: OrderStatus[] }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(changeOrderStatusAction, {});
  if (allowed.length === 0) return <p className="text-sm text-adm-muted">Поръчката е в краен статус. Няма следващи стъпки.</p>;
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="from" value={from} />
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <SubmitButton
            key={to}
            name="to"
            value={to}
            className={to === "cancelled" || to === "refused" ? "adm-btn-ghost" : "adm-btn"}
          >
            {LABELS[to] ?? to}
          </SubmitButton>
        ))}
      </div>
      {state.error && <p role="alert" className="text-sm font-semibold text-adm-down">{state.error}</p>}
    </form>
  );
}
