import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { AccountView } from "@/lib/session-types";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { logoutCustomerFn, requestCustomerOtpFn, updateCustomerProfileFn, verifyCustomerOtpFn } from "@/server/auth/api";
import { useWishlist } from "@/lib/cart-store";
import { WISHLIST_MIGRATE_DONE, WISHLIST_MIGRATE_FAILED } from "@/lib/wishlist-rules";
import { wishlistSync } from "./wishlist-client";
import { AddressBook } from "./address-book";
import { ContactLines } from "./contact-lines";
import type { StoreProfile } from "@/lib/store-types";
import { buttonGhost, buttonPrimary, fieldClass, pageKicker, pageTitle, panelClass } from "./ui";

export function AccountPanel({ account, section = "profile", contactProfile }: { account: AccountView; section?: AccountSection; contactProfile?: StoreProfile }) {
  if (account.authenticated) return <SignedIn account={account} section={section} contactProfile={contactProfile} />;
  return <SignIn />;
}

type AccountSection = "profile" | "orders" | "addresses" | "settings" | "contact";

function SignIn() {
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setMessage("");
    if (mobile.trim().length < 10) {
      setError("شماره موبایل را با ۱۱ رقم و شروع ۰۹ وارد کنید.");
      return;
    }
    setPending(true);
    try {
      const result = await requestCustomerOtpFn({ data: { mobile } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStep("code");
      setPreviewCode(result.previewCode ?? null);
      setMessage(
        result.sms === "preview"
          ? "پیامک وصل نیست. این کد فقط در پیش‌نمایش داخلی دیده می‌شود."
          : `کد تا ${toPersianNum(result.expiresInSec)} ثانیه معتبر است.`,
      );
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (code.trim().length < 5) {
      setError("کد پنج‌رقمی را وارد کنید.");
      return;
    }
    setPending(true);
    try {
      const result = await verifyCustomerOtpFn({ data: { mobile, code } });
      if (!result.ok) {
        setError(result.message);
        setPending(false);
        return;
      }
      // Copy the guest list into the account. Nothing is cleared unless the server confirms it; on
      // failure the ids stay on this browser and /account shows a retry notice (WishlistMigrationNotice).
      await wishlistSync.migrate();
      window.location.assign("/account");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={pageTitle}>ورود با شماره موبایل</h1>
      <p className="mt-3 text-sm leading-8">
        کد یک‌بارمصرف برای همین شماره ساخته می‌شود. رمز عبور مشتری ذخیره نمی‌شود. سفارش پرداخت‌نشده، اگر با همین شماره وارد شوید، به همین حساب وصل می‌شود.
      </p>
      {step === "mobile" ? (
        <form onSubmit={requestCode} className={`${panelClass} mt-6 space-y-4 p-5`}>
          <label className="block text-sm font-bold text-forest">
            شماره موبایل
            <input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="0912xxxxxxx"
              className={`${fieldClass} mt-2 text-left`}
            />
          </label>
          {error ? <p className="text-sm font-bold text-forest" role="alert">{error}</p> : null}
          <button type="submit" className={buttonPrimary} disabled={pending}>
            {pending ? "در حال ساخت کد" : "دریافت کد"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className={`${panelClass} mt-6 space-y-4 p-5`}>
          <p className="text-sm leading-7">کد برای شماره <span dir="ltr" className="font-bold text-forest">{mobile}</span></p>
          {previewCode ? (
            <p className="rounded-2xl bg-cream px-4 py-3 text-sm leading-7">
              پیش‌نمایش داخلی
              <span dir="ltr" className="mt-1 block text-2xl font-bold tracking-widest text-forest">{previewCode}</span>
            </p>
          ) : null}
          {message ? <p className="text-sm leading-7 text-muted">{message}</p> : null}
          <label className="block text-sm font-bold text-forest">
            کد ورود
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={8}
              className={`${fieldClass} mt-2 text-center tracking-widest`}
            />
          </label>
          {error ? <p className="text-sm font-bold text-forest" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonPrimary} disabled={pending}>
              {pending ? "در حال بررسی" : "تأیید و ورود"}
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={pending}
              onClick={() => void requestCode()}
            >
              ارسال دوباره
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function WishlistMigrationNotice() {
  const waiting = useWishlist((state) => state.pending.length);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await wishlistSync.migrate();
      if (result.status === "failed") setNote({ text: WISHLIST_MIGRATE_FAILED, error: true });
      else if (result.status === "done") setNote({ text: WISHLIST_MIGRATE_DONE, error: false });
    } finally {
      setBusy(false);
    }
  }

  if (waiting === 0 && !note) return null;
  return (
    <div className="rounded-2xl border border-gold/50 bg-cream p-4 text-sm leading-7" role={note && !note.error ? "status" : "alert"}>
      <p className="font-bold text-forest">{note ? note.text : WISHLIST_MIGRATE_FAILED}</p>
      {waiting > 0 ? (
        <button type="button" className={`mt-3 ${buttonGhost}`} disabled={busy} onClick={() => void retry()}>
          {busy ? "در حال انتقال" : "تلاش دوباره"}
        </button>
      ) : null}
    </div>
  );
}

function SignedIn({ account, section, contactProfile }: { account: Extract<AccountView, { authenticated: true }>; section: AccountSection; contactProfile?: StoreProfile }) {
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [gender, setGender] = useState(account.gender ?? "");
  const [ageGroup, setAgeGroup] = useState(account.ageGroup ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    try {
      const result = await updateCustomerProfileFn({ data: { firstName, lastName, gender: gender || null, ageGroup: ageGroup || null } });
      if (!result.ok) { setError(result.message); return; }
      setFirstName(result.firstName);
      setLastName(result.lastName);
      setGender(result.gender ?? "");
      setAgeGroup(result.ageGroup ?? "");
      setSaved(true);
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await logoutCustomerFn();
      wishlistSync.logout();
      window.location.assign("/account");
    } catch {
      setError("خروج انجام نشد. دوباره تلاش کنید.");
      setPending(false);
    }
  }

  const nav: Array<{ id: AccountSection; label: string; href: "/account" | "/account/orders" | "/account/addresses" | "/account/settings" | "/account/contact" }> = [
    { id: "profile", label: "اطلاعات شخصی", href: "/account" },
    { id: "orders", label: "سفارش‌های من", href: "/account/orders" },
    { id: "addresses", label: "نشانی‌های من", href: "/account/addresses" },
    { id: "settings", label: "تنظیمات حساب", href: "/account/settings" },
    { id: "contact", label: "ارتباط با شاهو", href: "/account/contact" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5">
        <p className={pageKicker}>SHAHOO</p>
        <h1 className={pageTitle}>{account.fullName.trim() || "حساب کاربری"}</h1>
        <p className="mt-2 text-sm text-muted" dir="ltr">{account.mobile}</p>
      </div>
      <WishlistMigrationNotice />
      <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="بخش‌های حساب کاربری">
        {nav.map((item) => (
          <Link key={item.id} to={item.href} aria-current={section === item.id ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-2xl border px-3 py-2 text-center text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${section === item.id ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-forest hover:border-gold hover:bg-cream"}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <main className={`${panelClass} mt-5 p-4 sm:p-6`}>
        {section === "profile" ? (
          <form onSubmit={saveProfile} className="max-w-2xl space-y-4">
            <h2 className="text-lg font-bold text-forest">اطلاعات شخصی</h2>
            <p className="text-xs text-muted">نام و نام خانوادگی الزامی است. شماره موبایلِ ورود فقط از طریق فرایند احراز هویت تغییر می‌کند.</p>
            <label className="block text-sm font-bold text-forest">نام <span aria-hidden="true">*</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={`${fieldClass} mt-2`} autoComplete="given-name" maxLength={40} required />
            </label>
            <label className="block text-sm font-bold text-forest">نام خانوادگی <span aria-hidden="true">*</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} className={`${fieldClass} mt-2`} autoComplete="family-name" maxLength={40} required />
            </label>
            <label className="block text-sm font-bold text-forest">شماره موبایل <span aria-hidden="true">*</span>
              <input value={account.mobile} readOnly aria-required="true" dir="ltr" className={`${fieldClass} mt-2 bg-cream text-left text-muted`} />
            </label>
            <fieldset className="space-y-3 rounded-2xl border border-line p-4">
              <legend className="px-2 text-sm font-bold text-forest">اطلاعات اختیاری</legend>
              <p className="text-sm leading-7 text-muted">با تکمیل این اطلاعات، به ما کمک می‌کنید محصولات و پیشنهادهای مرتبط‌تری برای شما فراهم کنیم.</p>
              <label className="block text-sm font-bold text-forest">جنسیت (اختیاری)
                <select value={gender} onChange={(event) => setGender(event.target.value)} className={`${fieldClass} mt-2`}>
                  <option value="">انتخاب نشده</option><option value="female">زن</option><option value="male">مرد</option><option value="prefer_not_to_say">ترجیح می‌دهم نگویم</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-forest">گروه سنی (اختیاری)
                <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} className={`${fieldClass} mt-2`}>
                  <option value="">انتخاب نشده</option><option value="under_18">کمتر از ۱۸</option><option value="18_24">۱۸–۲۴</option><option value="25_34">۲۵–۳۴</option><option value="35_44">۳۵–۴۴</option><option value="45_54">۴۵–۵۴</option><option value="55_plus">۵۵+</option><option value="prefer_not_to_say">ترجیح می‌دهم اعلام نکنم</option>
                </select>
              </label>
            </fieldset>
            {error ? <p className="text-sm font-bold text-forest" role="alert">{error}</p> : null}
            {saved ? <p className="text-sm text-forest" role="status">اطلاعات ذخیره شد.</p> : null}
            <button type="submit" className={buttonPrimary} disabled={pending}>{pending ? "در حال ذخیره" : "ذخیره اطلاعات"}</button>
          </form>
        ) : null}

        {section === "orders" ? (
          <section aria-labelledby="orders-heading">
            <h2 id="orders-heading" className="text-lg font-bold text-forest">سفارش‌های من</h2>
            {account.orders.length === 0 ? <p className="mt-3 rounded-2xl bg-cream p-4 text-sm leading-8 text-muted">هنوز سفارشی برای این حساب ثبت نشده است.</p> : (
              <ul className="mt-4 space-y-3">
                {account.orders.map((order) => (
                  <li key={order.publicCode}>
                    <Link to="/order/$orderId" params={{ orderId: order.publicCode }} className={`${panelClass} block border border-line p-4 text-sm hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}>
                      <span className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold text-forest" dir="ltr">{order.publicCode}</span><span>{order.statusLabel}</span></span>
                      <span className="mt-2 grid gap-1 text-muted sm:grid-cols-3"><span>{order.createdAtLabel}</span><span>{order.paymentStatusLabel}</span><span className="font-bold tabular-nums text-forest">{formatTomanFromIrr(order.totalIrr)}</span></span>
                      <span className="mt-2 block text-xs text-forest">مشاهده جزئیات سفارش ←</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {account.orders.length === 20 ? <p className="mt-3 text-xs leading-6 text-muted">۲۰ سفارش اخیر نمایش داده می‌شود.</p> : null}
          </section>
        ) : null}

        {section === "addresses" ? <AddressBook /> : null}

        {section === "settings" ? (
          <section className="max-w-xl space-y-3" aria-labelledby="settings-heading">
            <h2 id="settings-heading" className="text-lg font-bold text-forest">تنظیمات حساب</h2>
            <p className="text-sm leading-7 text-muted">ورود این حساب با کد یک‌بارمصرف و شماره موبایل انجام می‌شود. تنظیم امنیتی یا مدیریت نشست دیگری در این نسخه پشتیبانی نمی‌شود.</p>
            {error ? <p className="text-sm font-bold text-forest" role="alert">{error}</p> : null}
            <button type="button" className={buttonGhost} disabled={pending} onClick={() => void logout()}>{pending ? "در حال خروج" : "خروج از حساب"}</button>
          </section>
        ) : null}

        {section === "contact" ? (
          <section className="max-w-xl" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-lg font-bold text-forest">ارتباط با شاهو</h2>
            {contactProfile ? <ContactLines profile={contactProfile} className="mt-4 space-y-3 text-sm leading-7" /> : null}
            <p className="mt-4 text-sm leading-7 text-muted">راه‌های تماس فقط در صورت ثبت و تأیید فروشگاه نمایش داده می‌شوند. پشتیبانی آنلاین/تیکت از حساب مشتری در دسترس نیست.</p>
            <Link to="/contact" className={`mt-4 ${buttonGhost}`}>صفحه تماس با شاهو</Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
