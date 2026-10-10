"use client";
import { useActionState } from "react";
import type { ShippingActionState } from "@/app/actions/shipping";
import { SubmitButton } from "../SubmitButton";

type Action = (prev: ShippingActionState, formData: FormData) => Promise<ShippingActionState>;

function Result({ state }: { state: ShippingActionState }) {
  if (state.error) return <p role="alert" className="text-sm font-semibold text-adm-down">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm font-semibold text-adm-up">{state.message}</p>;
  return null;
}

/** One button that runs a courier action and shows its answer below. */
export function ShippingButton({
  action,
  fields = {},
  label,
  pendingText,
  ghost,
}: {
  action: Action;
  fields?: Record<string, string | number>;
  label: string;
  pendingText: string;
  ghost?: boolean;
}) {
  const [state, formAction] = useActionState<ShippingActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton className={ghost ? "adm-btn-ghost" : "adm-btn"} pendingText={pendingText}>{label}</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function CreateShipmentForm({
  action,
  orderId,
  weightKg,
  description,
  buttonLabel,
}: {
  action: Action;
  orderId: number;
  weightKg: string;
  description: string;
  buttonLabel: string;
}) {
  const [state, formAction] = useActionState<ShippingActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="weightKg" className="adm-label">Тегло, кг</label>
          <input id="weightKg" name="weightKg" inputMode="decimal" className="adm-input" defaultValue={weightKg} />
        </div>
        <div>
          <label htmlFor="description" className="adm-label">Съдържание</label>
          <input id="description" name="description" maxLength={50} className="adm-input" defaultValue={description} />
        </div>
      </div>
      <SubmitButton className="adm-btn" pendingText="Свързваме се с куриера...">{buttonLabel}</SubmitButton>
      <Result state={state} />
    </form>
  );
}
