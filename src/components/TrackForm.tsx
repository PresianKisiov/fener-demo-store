"use client";
import Link from "next/link";
import { useActionState } from "react";
import { trackOrderAction, type TrackState } from "@/app/actions/customer";
import { SubmitButton } from "./SubmitButton";

export function TrackForm() {
  const [state, formAction] = useActionState<TrackState, FormData>(trackOrderAction, {});
  return (
    <>
      <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="number" className="label">Номер на поръчката</label>
          <input id="number" name="number" className="field" placeholder="2026-000001" defaultValue={state.values?.number} />
        </div>
        <div>
          <label htmlFor="email" className="label">Имейл</label>
          <input id="email" name="email" type="email" className="field" defaultValue={state.values?.email} />
        </div>
        <SubmitButton pendingText="Търсим...">Покажи</SubmitButton>
      </form>
      <div aria-live="polite" className="mt-8">
        {state.error && <p className="text-sale">{state.error}</p>}
        {state.order && (
          <div className="rounded-3xl bg-white p-6">
            <p className="text-ink-soft">Поръчка {state.order.number} от {state.order.createdAt}</p>
            <p className="mt-1 font-display text-2xl" data-testid="tracking-status">{state.order.status}</p>
            <ul className="mt-4 text-sm">
              {state.order.items.map((i) => (
                <li key={i.name}>{i.name} x {i.quantity}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm">{state.order.courier}: {state.order.deliveryLabel}</p>
            {state.order.trackingNumber && (
              <p className="mt-1 text-sm">Товарителница: <span className="font-semibold">{state.order.trackingNumber}</span></p>
            )}
            {state.order.canWithdraw && (
              <Link href="/otkaz" className="btn-secondary mt-6">Отказ от договора</Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
