import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Menu, Search, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ShellData } from "@/lib/store-types";
import { getCart } from "@/server/commerce/api";
import { adoptBrowserCartOnce, cartRevision, cartWritePending } from "./cart-client";
import { CartDrawer } from "./cart-drawer";
import { ContactLines } from "./contact-lines";

function navActive(href: string, pathname: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ shell, children }: { shell: ShellData; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [count, setCount] = useState<number | null>(null);
  const readSequence = useRef(0);
  const onDrawerCount = useCallback((next: number) => {
    readSequence.current += 1;
    setCount(next);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ticket = ++readSequence.current;
      if (cartWritePending()) return;
      const revision = cartRevision();
      try {
        await adoptBrowserCartOnce();
        const cart = await getCart();
        if (!cancelled && ticket === readSequence.current && revision === cartRevision()) setCount(cart.count);
      } catch {
        if (!cancelled && ticket === readSequence.current && revision === cartRevision()) setCount(null);
      }
    };
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      readSequence.current += 1;
      if (typeof detail === "number" && document.visibilityState !== "hidden") setCount(detail);
      void load();
    };
    const onWrite = () => { if (cartWritePending()) setCount(null); void load(); };
    const onFocus = () => { setCount(null); void load(); };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { readSequence.current += 1; setCount(null); }
      else onFocus();
    };
    window.addEventListener("shahoo-cart", onChange);
    window.addEventListener("shahoo-cart-write", onWrite);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    setCount(null);
    void load();
    return () => {
      cancelled = true;
      window.removeEventListener("shahoo-cart", onChange);
      window.removeEventListener("shahoo-cart-write", onWrite);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <div className="min-h-screen bg-ivory text-ink">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-ivory"
      >
        رفتن به محتوای اصلی
      </a>
      {shell.promo ? (
        <div className="bg-deep px-4 py-2 text-center text-xs font-medium text-gold-soft">{shell.promo}</div>
      ) : null}
      <header className={`${shell.layout.stickyHeader ? "sticky top-0" : "relative"} z-30 border-b border-gold/50 bg-ivory/95 backdrop-blur`}>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-forest lg:hidden"
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="shrink-0">
            <img
              src={shell.logos.header}
              alt={shell.profile.brandName || "شاهو | SHAHOO"}
              style={{ height: shell.layout.headerLogoHeight }} className="w-auto max-h-20 max-w-28 object-contain sm:max-w-36"
            />
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="منوی اصلی">
            {shell.nav.map((item) => {
              const active = navActive(item.href, pathname);
              return (
                <a
                  key={item.href + item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${active ? "bg-forest text-ivory" : "text-forest hover:bg-cream"}`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <form action="/search" className="ms-auto hidden min-w-0 flex-1 items-center md:flex lg:max-w-56 lg:flex-none">
            <label className="relative w-full">
              <span className="sr-only">جستجو</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                name="q"
                aria-label="جستجوی محصول"
                placeholder="جستجوی محصول"
                suppressHydrationWarning
                className="h-11 w-full rounded-full border border-line bg-paper ps-10 pe-4 text-sm focus:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>
          </form>
          <Link
            to="/wishlist"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-forest transition hover:border-gold hover:bg-gold/15 active:bg-gold/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            aria-label="علاقه‌مندی‌ها"
          >
            <Heart className="h-5 w-5" />
          </Link>
          <Link
            to="/account"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-forest"
            aria-label="حساب کاربری"
          >
            <User className="h-5 w-5" />
          </Link>
          <CartDrawer count={count} pathname={pathname} onOpen={() => setOpen(false)} onCount={onDrawerCount} />
        </div>
        {open ? (
          <nav className="space-y-1 border-t border-gold/40 bg-cream px-4 py-3 lg:hidden" aria-label="منوی موبایل">
            {shell.nav.map((item) => {
              const active = navActive(item.href, pathname);
              return (
                <a
                  key={item.href + item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block min-h-12 rounded-2xl px-3 py-3 text-sm font-bold ${active ? "bg-forest text-ivory" : "text-forest hover:bg-ivory"}`}
                >
                  {item.label}
                </a>
              );
            })}
            <form action="/search" className="pt-2">
              <input name="q" aria-label="جستجوی محصول" placeholder="جستجوی محصول" suppressHydrationWarning className="h-11 w-full rounded-full border border-line bg-paper px-4 text-sm focus:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest" />
            </form>
          </nav>
        ) : null}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="mt-16 border-t-4 border-gold bg-deep text-ivory">
        <div className={`mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_1fr_1fr] ${shell.layout.footerAlignment === "center" ? "text-center justify-items-center" : "text-start"}`}>
          <div>
            <img src={shell.logos.footer} alt={shell.profile.brandName || "شاهو | SHAHOO"} style={{ height: shell.layout.footerLogoHeight }} className="w-auto max-h-36 max-w-48 object-contain" />
            {shell.profile.tagline.trim() ? (
              <p className="mt-4 max-w-sm text-sm leading-7 text-gold-soft">{shell.profile.tagline}</p>
            ) : null}
            <ContactLines profile={shell.profile} className="mt-4 space-y-1 text-sm leading-7" />
          </div>
          {shell.footer.map((column) => (
            <div key={column.title}>
              <h2 className="mb-3 text-sm font-bold text-gold-soft">{column.title}</h2>
              <ul className="space-y-1 text-sm">
                {column.links.map((item) => (
                  <li key={item.href + item.label}>
                    <a href={item.href} className="inline-flex min-h-11 items-center hover:text-gold-soft">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-forest px-4 py-4 text-center text-xs leading-6 text-gold-soft">
          {shell.profile.copyright.trim() ? <p>{shell.profile.copyright}</p> : null}
          <p className="mt-1 text-ivory/70">نماد اعتماد الکترونیکی تا دریافت تصویر رسمی نمایش داده نمی‌شود.</p>
        </div>
      </footer>
    </div>
  );
}
