"use client";
import { useRouter } from "next/navigation";

export function MonthSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Период"
      value={value}
      onChange={(e) => router.push(`/admin?m=${e.target.value}`, { scroll: false })}
      className="h-9 rounded-lg border border-adm-line bg-[#fcfdfd] px-3 text-sm font-semibold text-adm-muted"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
