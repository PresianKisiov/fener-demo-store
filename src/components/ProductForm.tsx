"use client";
import { useActionState, useState } from "react";
import { updateProductAction, type ProductFormState } from "@/app/actions/admin";
import type { Product } from "@/db/schema";
import { SubmitButton } from "./SubmitButton";

function Field({ name, label, defaultValue, textarea, hint }: { name: string; label: string; defaultValue: string; textarea?: boolean; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="adm-label">{label}</label>
      {textarea ? (
        <textarea id={name} name={name} rows={4} className="adm-input" defaultValue={defaultValue} />
      ) : (
        <input id={name} name={name} className="adm-input" defaultValue={defaultValue} />
      )}
      {hint && <p className="mt-1 text-xs text-adm-muted">{hint}</p>}
    </div>
  );
}

export function ProductForm({ product }: { product: Product }) {
  const [state, formAction] = useActionState<ProductFormState, FormData>(updateProductAction, {});
  const [inEu, setInEu] = useState(product.manufacturerInEu);
  // After an error, show what was typed instead of the saved product.
  const val = (name: keyof Product, fallback: string) => state.values?.[name] ?? fallback;
  const checked = (name: string, fallback: boolean) => (state.values ? state.values[name] === "on" : fallback);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="id" value={product.id} />

      <section className="adm-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Основни данни</h2>
        <Field name="name" label="Име" defaultValue={val("name", product.name)} />
        <Field name="shortDescription" label="Кратко описание" defaultValue={val("shortDescription", product.shortDescription)} />
        <Field name="description" label="Описание" defaultValue={val("description", product.description)} textarea />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="price" label="Цена с ДДС, €" defaultValue={state.values?.price ?? (product.priceCents / 100).toFixed(2).replace(".", ",")} hint="Всяка промяна се записва в ценовата история." />
          <div>
            <label htmlFor="stock" className="adm-label">Наличност, бр.</label>
            <input id="stock" name="stock" type="number" min={0} className="adm-input" defaultValue={state.values?.stock ?? product.stock} />
          </div>
          <div>
            <label htmlFor="weightGrams" className="adm-label">Тегло с кутията, г</label>
            <input id="weightGrams" name="weightGrams" type="number" min={1} className="adm-input" defaultValue={state.values?.weightGrams ?? product.weightGrams} />
            <p className="mt-1 text-xs text-adm-muted">Куриерът таксува по тегло. Сборът отива в товарителницата.</p>
          </div>
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="announceReduction" defaultChecked={checked("announceReduction", product.priorPriceCents !== null)} className="mt-1 size-5 accent-[#2f64e0]" />
          <span>
            Обяви като намаление
            <span className="block text-sm text-adm-muted">
              Системата сама намира най-ниската цена от последните 30 дни и показва процента спрямо нея. Ако новата цена не е по-ниска, няма да позволи.
            </span>
          </span>
        </label>
      </section>

      <section className="adm-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Безопасност на продукта (GPSR)</h2>
        <Field name="modelNumber" label="Модел или партида" defaultValue={val("modelNumber", product.modelNumber)} />
        <Field name="manufacturerName" label="Производител" defaultValue={val("manufacturerName", product.manufacturerName)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="manufacturerAddress" label="Пощенски адрес на производителя" defaultValue={val("manufacturerAddress", product.manufacturerAddress)} />
          <Field name="manufacturerEmail" label="Имейл на производителя" defaultValue={val("manufacturerEmail", product.manufacturerEmail)} />
        </div>
        <fieldset>
          <legend className="adm-label">Производителят е в ЕС?</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2"><input type="radio" name="manufacturerInEu" value="yes" checked={inEu} onChange={() => setInEu(true)} className="accent-[#2f64e0]" /> Да</label>
            <label className="flex items-center gap-2"><input type="radio" name="manufacturerInEu" value="no" checked={!inEu} onChange={() => setInEu(false)} className="accent-[#2f64e0]" /> Не</label>
          </div>
        </fieldset>
        <div className={inEu ? "hidden" : "space-y-4"}>
          <p className="text-sm text-adm-muted">Когато производителят е извън ЕС, трябва отговорно лице в ЕС (вносител или представител).</p>
          <Field name="euResponsibleName" label="Отговорно лице в ЕС" defaultValue={val("euResponsibleName", product.euResponsibleName)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="euResponsibleAddress" label="Адрес" defaultValue={val("euResponsibleAddress", product.euResponsibleAddress)} />
            <Field name="euResponsibleEmail" label="Имейл" defaultValue={val("euResponsibleEmail", product.euResponsibleEmail)} />
          </div>
        </div>
        <Field name="safetyWarnings" label="Предупреждения на български" defaultValue={val("safetyWarnings", product.safetyWarnings)} textarea />
      </section>

      <section className="adm-card flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="isPublished" defaultChecked={checked("isPublished", product.isPublished)} className="size-5 accent-[#2f64e0]" />
          Публикуван в магазина
        </label>
        <SubmitButton className="adm-btn" pendingText="Записваме...">Запази промените</SubmitButton>
        <div aria-live="polite" className="w-full text-sm">
          {state.error && <p className="font-semibold text-adm-down">{state.error}</p>}
          {state.saved && <p className="font-semibold text-adm-up">Записано.</p>}
        </div>
      </section>
    </form>
  );
}
