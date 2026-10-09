"use client";
/**
 * Withdrawal function ("бутон за отказ"), two steps as the EU rule requires:
 * step 1: the customer identifies themselves and the order;
 * step 2: they confirm with a clearly labelled button.
 * Only step 2 sends anything to the server.
 */
import { useActionState, useEffect, useState } from "react";
import { submitWithdrawalAction, type WithdrawalState } from "@/app/actions/customer";
import { SubmitButton } from "./SubmitButton";

type Draft = { customerName: string; number: string; email: string; reason: string };

export function WithdrawalForm() {
  const [state, formAction] = useActionState<WithdrawalState, FormData>(submitWithdrawalAction, {});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // If the server rejects the confirmation (e.g. wrong order number), go back to step 1 and show why.
  useEffect(() => {
    if (state.error) setShowConfirm(false);
  }, [state]);

  if (state.done) {
    return (
      <div role="status" className="rounded-3xl bg-white p-6">
        <h2 className="font-display text-2xl" data-testid="withdrawal-done">Отказът е получен</h2>
        <p className="mt-3">
          Поръчка {state.done.number}. Дата и час: {state.done.requestedAt}. Изпратихме потвърждение на {state.done.email}.
        </p>
        <p className="mt-3 text-ink-soft">В имейла пише къде да изпратиш стоката и кога ще върнем парите.</p>
      </div>
    );
  }

  if (draft && showConfirm) {
    return (
      <form action={formAction} className="rounded-3xl bg-white p-6">
        <h2 className="font-display text-xl">Провери и потвърди</h2>
        <dl className="mt-4 space-y-1 text-sm">
          <div><dt className="inline text-ink-soft">Име: </dt><dd className="inline">{draft.customerName}</dd></div>
          <div><dt className="inline text-ink-soft">Поръчка: </dt><dd className="inline">{draft.number}</dd></div>
          <div><dt className="inline text-ink-soft">Потвърждение ще получиш на: </dt><dd className="inline">{draft.email}</dd></div>
          <div><dt className="inline text-ink-soft">Причина: </dt><dd className="inline">{draft.reason || "не е посочена"}</dd></div>
        </dl>
        <p className="mt-4 text-sm">Отказваш се от целия договор за тази поръчка.</p>
        {Object.entries(draft).map(([k, val]) => (
          <input key={k} type="hidden" name={k} value={val} />
        ))}
        <div className="mt-6 flex flex-wrap gap-3">
          <SubmitButton pendingText="Изпращаме...">Потвърждавам отказа</SubmitButton>
          <button type="button" className="btn-secondary" onClick={() => setShowConfirm(false)}>Назад</button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const next: Draft = {
          customerName: String(f.get("customerName") ?? "").trim(),
          number: String(f.get("number") ?? "").trim(),
          email: String(f.get("email") ?? "").trim(),
          reason: String(f.get("reason") ?? "").trim(),
        };
        if (!next.customerName || !next.number || !next.email) {
          setStepError("Попълни име, номер на поръчката и имейл.");
          return;
        }
        setStepError(null);
        setDraft(next);
        setShowConfirm(true);
      }}
    >
      {(stepError || state.error) && <p role="alert" className="text-sale">{stepError ?? state.error}</p>}
      <div>
        <label htmlFor="customerName" className="label">Име и фамилия</label>
        <input id="customerName" name="customerName" className="field" autoComplete="name" defaultValue={draft?.customerName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="number" className="label">Номер на поръчката</label>
          <input id="number" name="number" className="field" placeholder="2026-000001" defaultValue={draft?.number} />
        </div>
        <div>
          <label htmlFor="email" className="label">Имейл от поръчката</label>
          <input id="email" name="email" type="email" className="field" autoComplete="email" defaultValue={draft?.email} />
        </div>
      </div>
      <div>
        <label htmlFor="reason" className="label">Причина (не е задължително)</label>
        <textarea id="reason" name="reason" rows={3} className="field" defaultValue={draft?.reason} />
      </div>
      <button type="submit" className="btn-primary">Продължи</button>
    </form>
  );
}
