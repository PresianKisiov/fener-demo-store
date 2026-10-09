"use client";
/**
 * Daily sales as an area chart, drawn with plain SVG. Hover (or touch) shows
 * the day's revenue and number of orders. A table with the same numbers is
 * available below the chart for screen readers and exact reading.
 */
import { useEffect, useRef, useState } from "react";

export type SalesPoint = { day: string; tick: string; label: string; revenueCents: number; orders: number };

const eur0 = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" });

function niceStep(max: number, count: number) {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return step;
}

export function SalesChart({ points, title }: { points: SalesPoint[]; title: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrap.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    return <p className="py-16 text-center text-adm-muted">Няма продажби за този месец.</p>;
  }

  const height = width < 520 ? 220 : 290;
  const pad = { left: width < 520 ? 52 : 64, right: 14, top: 18, bottom: 30 };
  const maxEur = Math.max(...points.map((p) => p.revenueCents), 100) / 100;
  const step = niceStep(maxEur, 4);
  const yMax = Math.ceil(maxEur / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (cents: number) => pad.top + innerH - (cents / 100 / yMax) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenueCents).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.top + innerH} L${x(0).toFixed(1)},${pad.top + innerH} Z`;
  const labelEvery = Math.max(1, Math.ceil(points.length / (width < 520 ? 4 : 7)));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))));
  }

  const total = points.reduce((s, p) => s + p.revenueCents, 0);
  const active = hover !== null ? points[hover] : null;

  return (
    <div>
      <div ref={wrap} className="relative w-full overflow-hidden">
        <svg width={width} height={height} role="img" aria-label={`${title}: общо ${eur2.format(total / 100)}`} className="block">
          <defs>
            <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4880ff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#4880ff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t * 100)} y2={y(t * 100)} stroke="#eceef2" />
              <text x={pad.left - 10} y={y(t * 100)} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#646464">
                {eur0.format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 && points.length - 1 - i >= labelEvery / 2 || i === points.length - 1 ? (
              <text key={p.day} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="12" fill="#646464">
                {p.tick}
              </text>
            ) : null,
          )}
          <path d={area} fill="url(#sales-fill)" />
          <path d={line} fill="none" stroke="#4880ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="#9aa3b2" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(points[hover].revenueCents)} r="5" fill="#4880ff" stroke="#fff" strokeWidth="2" />
            </>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-adm-blue px-3 py-1.5 text-xs text-white shadow"
            style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: y(active.revenueCents) - 10 }}
          >
            <span className="block font-bold">{eur2.format(active.revenueCents / 100)}</span>
            <span className="block">
              {active.label}, {active.orders} {active.orders === 1 ? "поръчка" : "поръчки"}
            </span>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-adm-muted">Покажи като таблица</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <thead>
            <tr><th className="py-1 pr-4">Ден</th><th className="py-1 pr-4 text-right">Продажби</th><th className="py-1 text-right">Поръчки</th></tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-adm-line">
                <td className="py-1 pr-4">{p.label}</td>
                <td className="py-1 pr-4 text-right tabular">{eur2.format(p.revenueCents / 100)}</td>
                <td className="py-1 text-right tabular">{p.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
