"use client";
/**
 * Admin frame: sidebar on the left, top bar with search, notifications and the
 * signed-in admin. On phones the sidebar opens as a drawer from the menu button.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/admin";
import { Icon } from "./Icon";

const NAV = [
  { href: "/admin", label: "Табло", icon: "dashboard" },
  { href: "/admin/poruchki", label: "Поръчки", icon: "orders" },
  { href: "/admin/produkti", label: "Продукти", icon: "products" },
  { href: "/admin/nalichnosti", label: "Наличности", icon: "stock" },
  { href: "/admin/kurieri", label: "Куриери", icon: "truck" },
  { href: "/admin/otkazi", label: "Откази", icon: "withdrawals" },
  { href: "/admin/imeyli", label: "Изпратени имейли", icon: "mail" },
];

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminShell({
  admin,
  notifications,
  children,
}: {
  admin: { name: string; email: string };
  notifications: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Админ меню" className="flex h-full flex-col">
      <div className="flex h-[70px] items-center gap-2 px-6">
        <Link href="/admin" className="font-display text-xl font-semibold text-adm-ink">
          <span className="text-adm-blue">Фенер</span> admin
        </Link>
      </div>
      <ul className="space-y-1 py-3 pr-4">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="relative pl-6">
              {active && <span className="absolute left-0 top-0 h-full w-1.5 rounded-r-md bg-adm-blue" aria-hidden="true" />}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-[0.92rem] font-semibold ${
                  active ? "bg-adm-blue text-white" : "text-adm-ink hover:bg-adm-bg"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-adm-line py-4 pl-6 pr-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-[0.92rem] font-semibold hover:bg-adm-bg">
          <Icon name="store" />
          Към магазина
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[0.92rem] font-semibold hover:bg-adm-bg">
            <Icon name="logout" />
            Изход
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="admin-root min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-adm-line bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
          <button type="button" className="absolute inset-0 bg-adm-ink/40" aria-label="Затвори менюто" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-[270px] bg-white shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-2 hover:bg-adm-bg" aria-label="Затвори менюто">
              <Icon name="close" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-adm-line bg-white px-4 sm:gap-5 sm:px-7">
          <button type="button" className="rounded-lg p-2 hover:bg-adm-bg lg:hidden" onClick={() => setOpen(true)} aria-label="Отвори менюто">
            <Icon name="menu" />
          </button>
          <form action="/admin/poruchki" role="search" className="relative min-w-0 flex-1 sm:max-w-[390px]">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-adm-muted" />
            <input
              name="q"
              type="search"
              placeholder="Търси поръчка, клиент или имейл"
              aria-label="Търси поръчки"
              className="h-[38px] w-full rounded-full border border-adm-line bg-adm-bg pl-11 pr-4 text-sm outline-none focus:border-adm-blue"
            />
          </form>
          <div className="ml-auto flex items-center gap-3 sm:gap-6">
            <Link
              href="/admin/poruchki?status=pending_confirmation"
              className="relative rounded-lg p-2 text-adm-blue hover:bg-adm-bg"
              aria-label={`${notifications} неща чакат действие`}
            >
              <Icon name="bell" className="size-6" />
              {notifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-adm-down px-1 text-[11px] font-bold text-white">
                  {notifications > 99 ? "99+" : notifications}
                </span>
              )}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-1 hover:bg-adm-bg">
                <span className="flex size-10 items-center justify-center rounded-full bg-adm-blue-soft text-sm font-extrabold text-adm-blue">
                  {initials(admin.name, admin.email)}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-bold">{admin.name}</span>
                  <span className="block text-xs text-adm-muted">{admin.email}</span>
                </span>
                <Icon name="chevron" className="size-4 text-adm-muted" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-adm-line bg-white p-2 shadow-lg">
                <p className="px-3 py-2 text-xs text-adm-muted sm:hidden">{admin.email}</p>
                <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-adm-bg">Към магазина</Link>
                <form action={logoutAction}>
                  <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-adm-bg">Изход</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
