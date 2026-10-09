"use client";

/** Quantity dropdown in the cart: changing it submits its form right away. */
export function QuantitySelect({ quantity, max, label }: { quantity: number; max: number; label: string }) {
  const options = Array.from({ length: Math.max(quantity, Math.min(max, 10)) }, (_, i) => i + 1);
  return (
    <select
      name="quantity"
      aria-label={label}
      defaultValue={quantity}
      className="field w-20"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
