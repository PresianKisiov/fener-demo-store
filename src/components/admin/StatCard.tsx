import { Icon } from "./Icon";

const ICON_TONES = {
  yellow: "bg-[#fff3d6] text-[#c78a00]",
  green: "bg-[#d9f7e8] text-[#1f9d63]",
  purple: "bg-[#e5e4ff] text-[#6b69f0]",
  orange: "bg-[#ffded1] text-[#e8673b]",
} as const;

export type Delta = { percent: number; text: string } | null;

const pct = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 1 });

/** Change between two periods as a percentage, or null if there is nothing to compare with. */
export function delta(current: number, previous: number, comparedTo: string): Delta {
  if (previous === 0) return null;
  return { percent: ((current - previous) / previous) * 100, text: comparedTo };
}

export function StatCard({
  label,
  value,
  icon,
  tone,
  change,
  note,
}: {
  label: string;
  value: string;
  icon: string;
  tone: keyof typeof ICON_TONES;
  change?: Delta;
  note?: string;
}) {
  const up = change ? change.percent >= 0 : false;
  return (
    <div className="adm-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.95rem] font-semibold text-adm-muted">{label}</p>
          <p className="mt-3 text-[1.75rem] font-extrabold leading-none tracking-tight">{value}</p>
        </div>
        <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${ICON_TONES[tone]}`}>
          <Icon name={icon} className="size-7" />
        </span>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-sm text-adm-muted">
        {change ? (
          <>
            <Icon name={up ? "up" : "down"} className={`size-5 ${up ? "text-adm-up" : "text-adm-down"}`} />
            <span className={`font-bold ${up ? "text-adm-up" : "text-adm-down"}`}>{pct.format(Math.abs(change.percent))}%</span>
            <span>
              {up ? "повече" : "по-малко"} {change.text}
            </span>
          </>
        ) : (
          <span>{note ?? "Няма данни за сравнение"}</span>
        )}
      </p>
    </div>
  );
}
