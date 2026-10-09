"use client";
import { useActionState } from "react";
import { createProductAction, type CreateProductState } from "@/app/actions/admin";
import { SubmitButton } from "../SubmitButton";

const DRAWINGS: [string, string][] = [
  ["clip", "Лампа с щипка"], ["booklight", "Лампа за книга"], ["neck", "Лампа за врат"], ["desk", "Настолна с рамо"],
  ["minidesk", "Малка настолна"], ["bedside", "Нощна лампа"], ["strip", "LED лента"], ["floor", "Подова лампа"],
];

export function NewProductForm({ categories }: { categories: string[] }) {
  const [state, formAction] = useActionState<CreateProductState, FormData>(createProductAction, {});
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
      <div>
        <label htmlFor="np-name" className="adm-label">Име</label>
        <input id="np-name" name="name" className="adm-input" placeholder="Лампа за пиано „Клавиш“" />
      </div>
      <div>
        <label htmlFor="np-category" className="adm-label">Категория</label>
        <input id="np-category" name="category" list="np-categories" className="adm-input" placeholder="За четене" />
        <datalist id="np-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div>
        <label htmlFor="np-price" className="adm-label">Цена, €</label>
        <input id="np-price" name="price" className="adm-input" placeholder="24,90" inputMode="decimal" />
      </div>
      <div>
        <label htmlFor="np-drawing" className="adm-label">Рисунка</label>
        <select id="np-drawing" name="illustration" className="adm-input">
          {DRAWINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <SubmitButton className="adm-btn" pendingText="Създаваме...">Създай</SubmitButton>
      {state.error && <p role="alert" className="text-sm font-semibold text-adm-down sm:col-span-2 lg:col-span-5">{state.error}</p>}
    </form>
  );
}
