import { useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AdminSession } from "@/lib/session-types";
import { logoutAdminFn } from "@/server/auth/api";

const LINKS: Array<{ href: string; label: string; group: string; allow: (permissions: string[]) => boolean }> = [
  { href: "/admin", label: "نمای کلی", group: "مدیریت روزانه", allow: () => true },
  { href: "/admin/orders", label: "سفارش‌ها", group: "مدیریت روزانه", allow: (permissions) => permissions.includes("orders.read") },
  { href: "/admin/customers", label: "مشتریان", group: "مدیریت روزانه", allow: (permissions) => permissions.includes("customers.read") },
  { href: "/admin/catalog", label: "کاتالوگ", group: "کالا و فروش", allow: (permissions) => permissions.includes("catalog.read") },
  { href: "/admin/content", label: "محتوا و برند", group: "سایت و محتوا", allow: (permissions) => permissions.includes("content.write") },
  { href: "/admin/inventory", label: "موجودی", group: "کالا و فروش", allow: (permissions) => permissions.includes("inventory.read") || permissions.includes("inventory.write") },
  { href: "/admin/offers", label: "تخفیف و ارسال", group: "کالا و فروش", allow: (permissions) => permissions.includes("settings.read") || permissions.includes("settings.write") },
  { href: "/admin/support", label: "پشتیبانی", group: "مدیریت روزانه", allow: (permissions) => permissions.includes("customers.read") || permissions.includes("support.write") },
  { href: "/admin/reviews", label: "نظرها", group: "کالا و فروش", allow: (permissions) => permissions.includes("catalog.read") },
  { href: "/admin/reports", label: "گزارش‌ها", group: "کنترل و دسترسی", allow: (permissions) => permissions.includes("reports.read") },
  { href: "/admin/staff", label: "مدیران", group: "کنترل و دسترسی", allow: (permissions) => permissions.includes("admins.read") || permissions.includes("admins.write") },
];

export function AdminDenied({ message }: { message: string }) {
  return (
    <p className="rounded-3xl bg-cream p-5 text-sm font-bold leading-8 text-forest" role="alert">
      {message}
    </p>
  );
}

export function AdminShell({ session, children }: { session: Extract<AdminSession, { authenticated: true }>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => setOpen(false), [pathname]);
  const items = LINKS.filter((item) => item.allow(session.permissions));

  async function logout() {
    setPending(true);
    try {
      await logoutAdminFn();
      window.location.assign("/admin");
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line lg:hidden"
            aria-label={open ? "بستن منوی مدیریت" : "باز کردن منوی مدیریت"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/assets/brand/shahoo-logo-minimal.png" alt="شاهو" className="h-11 w-auto" />
          <div className="ms-auto text-end">
            <p className="text-sm font-bold text-forest">{session.fullName}</p>
            <button type="button" className="text-xs font-bold text-gold" disabled={pending} onClick={() => void logout()}>
              خروج
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl">
        <aside className="hidden w-56 shrink-0 border-e border-line bg-cream/70 p-4 lg:block">
          <Nav items={items} pathname={pathname} />
        </aside>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-deep/40" aria-label="بستن منو" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-cream p-4 shadow-xl">
              <Nav items={items} pathname={pathname} />
            </aside>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

function Nav({ items, pathname }: { items: Array<{ href: string; label: string }>; pathname: string }) {
  return (
    <nav className="space-y-1" aria-label="بخش‌های مدیریت">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex min-h-11 items-center rounded-2xl px-3 text-sm font-bold ${active ? "bg-forest text-ivory" : "text-forest hover:bg-ivory"}`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
