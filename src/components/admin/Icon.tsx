/** Small line icons for the admin panel (24x24 grid, drawn for this project). */
const PATHS: Record<string, React.ReactNode> = {
  dashboard: <><path d="M4 13a8 8 0 1 1 16 0" /><path d="M12 13l4-4" /><path d="M4 17h16" /></>,
  orders: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  products: <><path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4M12 11v10" /></>,
  stock: <><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" /><path d="M8 7h3M8 17h3" /></>,
  withdrawals: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  store: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v3a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 12z" /><path d="M5 14v6h14v-6" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  chevron: <><path d="M7 10l5 5 5-5" /></>,
  box: <><path d="M4 8l8-4 8 4-8 4z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></>,
  trend: <><path d="M4 17l5-5 4 4 7-7" /><path d="M15 9h5v5" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  up: <><path d="M4 16l6-6 4 4 6-6" /><path d="M15 8h5v5" /></>,
  down: <><path d="M4 8l6 6 4-4 6 6" /><path d="M15 16h5v-5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
};

export function Icon({ name, className = "size-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  );
}
