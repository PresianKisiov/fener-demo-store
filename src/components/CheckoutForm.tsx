"use client";
/**
 * Checkout form. It runs in the browser only to make filling it in pleasant:
 * loading the offices of the chosen city and showing a live price preview with
 * the same priceCart() the server uses. When the form is sent, the server
 * validates everything again and recalculates the prices from the database.
 */
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/actions/checkout";
import { suggestEmail } from "@/lib/email-typo";
import { formatEur } from "@/lib/money";
import { priceCart, shippingPrice, type PricingLine } from "@/lib/pricing";
import {
  COURIERS,
  DELIVERY_TYPES,
  SHOP,
  type CourierId,
  type DeliveryType,
  type PaymentMethod,
} from "@/lib/settings";
import { CityPicker } from "./CityPicker";
import { SubmitButton } from "./SubmitButton";

type OfficeCity = { courier: string; kind: string; city: string };
type Office = { id: string; name: string; address: string; hours: string };

/** Loads the offices of one city from /api/offices (our database, not the courier). */
function useOffices(courier: string, kind: string, city: string) {
  const [result, setResult] = useState<{ key: string; offices: Office[]; failed: boolean }>({ key: "", offices: [], failed: false });
  const key = `${courier}|${kind}|${city}`;
  useEffect(() => {
    if (!city || kind === "address") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ courier, kind, city });
    fetch(`/api/offices?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { offices: Office[] }) => setResult({ key, offices: data.offices, failed: false }))
      .catch((error) => {
        if (error.name !== "AbortError") setResult({ key, offices: [], failed: true });
      });
    // A new city chosen before the answer arrived cancels the old request.
    return () => controller.abort();
  }, [courier, kind, city, key]);
  const ready = result.key === key;
  return { offices: ready ? result.offices : [], loading: Boolean(city) && !ready, failed: ready && result.failed };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="error-text">
      {message}
    </p>
  ) : null;
}

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  note,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  note?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 ${checked ? "border-night bg-white" : "border-line bg-white/60 hover:border-ink-soft"}`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 size-4 accent-night" />
      <span>
        <span className="block font-semibold">{title}</span>
        {note && <span className="block text-sm text-ink-soft">{note}</span>}
      </span>
    </label>
  );
}

export function CheckoutForm({
  lines,
  cities: allCities,
  simulatedCouriers = [],
}: {
  lines: PricingLine[];
  cities: OfficeCity[];
  simulatedCouriers?: string[];
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, { errors: {}, values: {} });
  const v = state.values;
  const e = state.errors;

  const [courier, setCourier] = useState<CourierId>((v.courier as CourierId) || "econt");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>((v.deliveryType as DeliveryType) || "office");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((v.paymentMethod as PaymentMethod) || "cod");
  const [city, setCity] = useState(v.officeCity ?? "");
  const [officeId, setOfficeId] = useState(v.officeId ?? "");
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const preview = priceCart({ lines, deliveryType, paymentMethod });

  const cities = allCities.filter((c) => c.courier === courier && c.kind === deliveryType).map((c) => c.city);
  const { offices: cityOffices, loading, failed } = useOffices(courier, deliveryType, city);

  const err = (key: string) => (e[key] ? { "aria-invalid": true as const, "aria-describedby": `${key}-error` } : {});

  // A city with a single office: choose it for the customer, one tap less.
  const onlyOffice = cityOffices.length === 1 ? cityOffices[0].id : null;
  useEffect(() => {
    if (onlyOffice) setOfficeId((current) => current || onlyOffice);
  }, [onlyOffice]);

  function chooseCity(next: string) {
    setCity(next);
    setOfficeId("");
  }

  // React clears a form after its action runs. On a validation error that would wipe
  // everything the customer typed (city, office, address). Sending the form ourselves
  // inside a transition skips that reset; without JavaScript the plain `action` still works.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-10">
        {state.formError && (
          <p role="alert" className="rounded-2xl border-[1.5px] border-sale bg-white p-4 text-sale">
            {state.formError}
          </p>
        )}
        {Object.keys(e).length > 0 && (
          <p role="alert" className="rounded-2xl border-[1.5px] border-sale bg-white p-4 text-sale">
            Поправи отбелязаните полета и опитай отново.
          </p>
        )}

        <fieldset>
          <legend className="font-display text-xl font-medium">1. Твоите данни</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="customerName" className="label">Име и фамилия</label>
              <input id="customerName" name="customerName" autoComplete="name" className="field" defaultValue={v.customerName} {...err("customerName")} />
              <FieldError id="customerName-error" message={e.customerName} />
            </div>
            <div>
              <label htmlFor="phone" className="label">Мобилен телефон</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0888 123 456" className="field" defaultValue={v.phone} {...err("phone")} />
              <FieldError id="phone-error" message={e.phone} />
            </div>
            <div>
              <label htmlFor="email" className="label">Имейл</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="field"
                defaultValue={v.email}
                aria-describedby="email-hint"
                onBlur={(event) => setEmailHint(suggestEmail(event.target.value.trim()))}
                {...err("email")}
              />
              <p id="email-hint" className="mt-1 text-sm text-ink-soft">Изпращаме потвърждението на поръчката тук.</p>
              {emailHint && (
                <p className="mt-1 text-sm" role="status">
                  Имаше предвид{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      const input = document.getElementById("email") as HTMLInputElement;
                      input.value = emailHint;
                      setEmailHint(null);
                    }}
                  >
                    {emailHint}
                  </button>
                  ?
                </p>
              )}
              <FieldError id="email-error" message={e.email} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-medium">2. Доставка</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(COURIERS) as CourierId[]).map((c) => (
              <Choice
                key={c}
                name="courier"
                value={c}
                checked={courier === c}
                onChange={() => { setCourier(c); chooseCity(""); }}
                title={COURIERS[c]}
                note={simulatedCouriers.includes(c) ? "Демо: само няколко примерни офиса" : undefined}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(Object.keys(DELIVERY_TYPES) as DeliveryType[]).map((t) => {
              const price = shippingPrice(t, subtotal);
              return (
                <Choice
                  key={t}
                  name="deliveryType"
                  value={t}
                  checked={deliveryType === t}
                  onChange={() => { setDeliveryType(t); chooseCity(""); }}
                  title={DELIVERY_TYPES[t]}
                  note={price === 0 ? "безплатно" : formatEur(price)}
                />
              );
            })}
          </div>

          {deliveryType === "address" ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
              <div>
                <label htmlFor="city" className="label">Населено място</label>
                <input id="city" name="city" autoComplete="address-level2" className="field" defaultValue={v.city} {...err("city")} />
                <FieldError id="city-error" message={e.city} />
              </div>
              <div>
                <label htmlFor="postCode" className="label">Пощенски код</label>
                <input id="postCode" name="postCode" autoComplete="postal-code" inputMode="numeric" maxLength={4} placeholder="5300" className="field" defaultValue={v.postCode} {...err("postCode")} />
                <FieldError id="postCode-error" message={e.postCode} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="address" className="label">Улица, номер, вход, етаж</label>
                <input id="address" name="address" autoComplete="street-address" className="field" defaultValue={v.address} {...err("address")} />
                <FieldError id="address-error" message={e.address} />
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div>
                <label htmlFor="officeCity" className="label">Град</label>
                <CityPicker id="officeCity" name="officeCity" cities={cities} value={city} onChange={chooseCity} />
              </div>
              <div>
                <label htmlFor="officeId" className="label">{deliveryType === "locker" ? "Автомат" : "Офис"}</label>
                <select
                  id="officeId"
                  name="officeId"
                  className="field"
                  value={officeId}
                  onChange={(event) => setOfficeId(event.target.value)}
                  disabled={!city || loading}
                  {...err("officeId")}
                >
                  <option value="">{!city ? "Първо избери град" : loading ? "Зареждаме офисите..." : "Избери от списъка"}</option>
                  {cityOffices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}, {o.address} ({o.hours})
                    </option>
                  ))}
                </select>
                <FieldError id="officeId-error" message={e.officeId} />
                {failed && <p className="error-text">Списъкът с офиси не се зареди. Избери града отново.</p>}
              </div>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-medium">3. Плащане</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice name="paymentMethod" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} title="Наложен платеж" note={`Плащаш на куриера. Такса ${formatEur(SHOP.codFeeCents)}.`} />
            <Choice name="paymentMethod" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} title="С карта" note="Отиваш на страницата на тестовия доставчик." />
          </div>
        </fieldset>
      </div>

      <aside className="h-fit rounded-3xl bg-white p-6 lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-medium">Твоята поръчка</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {preview.lines.map((l) => (
            <li key={l.productId} className="tabular flex justify-between gap-3">
              <span>{l.name} x {l.quantity}</span>
              <span className="whitespace-nowrap">{formatEur(l.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="tabular mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>Продукти</dt><dd>{formatEur(preview.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Доставка</dt><dd>{preview.shippingCents === 0 ? "безплатно" : formatEur(preview.shippingCents)}</dd></div>
          {preview.codFeeCents > 0 && (
            <div className="flex justify-between"><dt>Такса наложен платеж</dt><dd>{formatEur(preview.codFeeCents)}</dd></div>
          )}
          <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold"><dt>Общо</dt><dd data-testid="checkout-total">{formatEur(preview.totalCents)}</dd></div>
          <div className="flex justify-between text-ink-soft"><dt>в т.ч. ДДС</dt><dd>{formatEur(preview.vatCents)}</dd></div>
        </dl>

        <p className="mt-5 text-sm text-ink-soft">
          Имаш право да се откажеш от поръчката в срок от {SHOP.withdrawalDays} дни от получаването, без да посочваш причина.{" "}
          <Link href="/usloviya" className="underline" target="_blank">Как става</Link>
        </p>

        <div className="mt-5 space-y-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="terms" className="mt-0.5 size-5 shrink-0 accent-night" defaultChecked={v.terms === "on"} {...err("terms")} />
            <span>
              Приемам <Link href="/usloviya" target="_blank" className="underline">общите условия</Link>.
            </span>
          </label>
          <FieldError id="terms-error" message={e.terms} />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketing" className="mt-0.5 size-5 shrink-0 accent-night" defaultChecked={v.marketing === "on"} />
            <span>Искам да получавам имейли за нови продукти и намаления. Не е задължително.</span>
          </label>
        </div>

        <SubmitButton className="btn-primary mt-6 w-full" pendingText="Изпращаме поръчката..." pending={pending}>
          Поръчка със задължение за плащане
        </SubmitButton>
      </aside>
    </form>
  );
}
