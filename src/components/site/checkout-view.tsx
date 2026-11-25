import { servesDestination } from "@/lib/public-shipping";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CartSnapshot, CheckoutContext, QuoteResult } from "@/lib/commerce-types";
import { checkoutCartExpectation, checkoutIdentityReadDecision, checkoutIntentsBlocked, checkoutReadIsCurrent, sameCheckoutCart } from "@/lib/checkout-cart-safety";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { IRAN_PROVINCES } from "@/server/commerce/pricing";
import { getCitiesForProvince } from "@/lib/iran-cities";
import { getCheckoutContext, placeOrderFn, quoteCheckoutFn } from "@/server/commerce/api";
import { initiatePayPingPaymentFn } from "@/server/payments/api";
import { adoptBrowserCartOnce, beginCartWrite, cartRevision, cartWritePending, getCartIntents, notifyCart } from "./cart-client";
import { buttonGhost, buttonPrimary, fieldClass, pageKicker, pageTitle, panelClass } from "./ui";

export function CheckoutView({ initial }: { initial: CheckoutContext }) {
  const original = useRef(initial).current;
  const initialOwner = useRef(original.account?.mobile ?? null);
  const initialAddress = original.addresses.find((item) => item.isDefault) ?? null;
  const [fullName, setFullName] = useState(initialAddress?.recipientName || original.account?.fullName || "");
  const [mobile, setMobile] = useState(initialAddress?.recipientMobile || original.account?.mobile || "");
  const [province, setProvince] = useState(initialAddress?.province ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [addressLine, setAddressLine] = useState(initialAddress?.addressLine ?? "");
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode ?? "");
  const [plaque, setPlaque] = useState(initialAddress?.plaque ?? "");
  const [unit, setUnit] = useState(initialAddress?.unit ?? "");
  const [addressId, setAddressId] = useState(initialAddress?.id ?? "");
  const selectedAddress = original.addresses.find((item) => item.id === addressId) ?? null;
  const recipientNameLocked = Boolean(selectedAddress?.recipientName);
  const [customerNote, setCustomerNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [preferredMethod, setShippingMethodId] = useState(original.methods[0]?.id ?? "");
  const availableMethods = initial.methods.filter((method) => servesDestination(method, province, city));
  const shippingMethodId = availableMethods.find((method) => method.id === preferredMethod)?.id ?? availableMethods[0]?.id ?? "";
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "payping">("manual");
  const [cart, setCart] = useState<CartSnapshot>(original.cart);
  const [identity, setIdentity] = useState<"unverified" | "verified" | "changed">("unverified");
  const [stale, setStale] = useState(true);
  const [checking, setChecking] = useState(true);
  const [cartPending, setCartPending] = useState(false);
  const [hasRetry, setHasRetry] = useState(false);
  const [quote, setQuote] = useState<{ result: QuoteResult; cart: CartSnapshot; method: string; coupon: string } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [priorAttempt, setPriorAttempt] = useState(false);
  const staleRef = useRef(true);
  const identityRef = useRef<"unverified" | "verified" | "changed">("unverified");
  const generation = useRef(0);
  const readTicket = useRef(0);
  const submitting = useRef(false);
  const ownWrite = useRef(false);
  const initialCart = useRef(original.cart);

  const invalidate = useCallback(() => {
    generation.current += 1;
    readTicket.current += 1;
    staleRef.current = true;
    setStale(true);
    setChecking(false);
    setQuote(null);
  }, []);

  const unverifyIdentity = useCallback(() => {
    if (identityRef.current !== "changed") {
      identityRef.current = "unverified";
      setIdentity("unverified");
    }
    invalidate();
  }, [invalidate]);

  const requireReload = useCallback(() => {
    identityRef.current = "changed";
    setIdentity("changed");
    invalidate();
  }, [invalidate]);

  const readVerifiedContext = useCallback(async (ticket: number, started: { revision: number; generation: number }) => {
    const accept = (next: CheckoutContext) => {
      if (ticket !== readTicket.current || identityRef.current === "changed") return false;
      const busy = cartWritePending();
      const retry = cartIntentsBlockCheckout();
      setCartPending(busy);
      setHasRetry(retry);
      const focused = document.hasFocus();
      const visible = document.visibilityState === "visible";
      const decision = checkoutIdentityReadDecision(initialOwner.current, next.account?.mobile ?? null, started, {
        revision: cartRevision(), generation: generation.current, pending: busy, retry, focused, visible,
      });
      if (decision === "owner_changed") requireReload();
      else if (decision === "stale") {
        if (!focused || !visible) unverifyIdentity();
        else invalidate();
      }
      return decision === "current";
    };

    // Check before adopting any legacy browser cart, and recheck afterwards.
    const before = await getCheckoutContext();
    if (!accept(before)) return null;
    await adoptBrowserCartOnce();
    if (ticket !== readTicket.current) return null;
    const after = await getCheckoutContext();
    return accept(after) ? after : null;
  }, [invalidate, requireReload, unverifyIdentity]);

  useEffect(() => {
    let active = true;
    let leftWindow = !document.hasFocus() || document.visibilityState !== "visible";
    const onChange = () => invalidate();
    const onWrite = () => {
      if (ownWrite.current) return;
      setCartPending(cartWritePending());
      invalidate();
    };
    const onRetry = () => {
      setHasRetry(cartIntentsBlockCheckout());
      invalidate();
    };
    const onBlur = () => { leftWindow = true; unverifyIdentity(); };
    const onFocus = () => {
      if (leftWindow) {
        leftWindow = false;
        setCartPending(cartWritePending());
        setHasRetry(cartIntentsBlockCheckout());
        unverifyIdentity();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") { leftWindow = true; unverifyIdentity(); }
      else onFocus();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setCartPending(cartWritePending());
        setHasRetry(cartIntentsBlockCheckout());
        unverifyIdentity();
      }
    };
    window.addEventListener("shahoo-cart", onChange);
    window.addEventListener("shahoo-cart-write", onWrite);
    window.addEventListener("shahoo-cart-retry", onRetry);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    const retry = cartIntentsBlockCheckout();
    const busy = cartWritePending();
    setHasRetry(retry);
    setCartPending(busy);
    try { setPriorAttempt(!!sessionStorage.getItem("shahoo-checkout-key")); } catch { setPriorAttempt(true); }

    // The route loader may have run before this component subscribed to events.
    // Only accept it automatically when a fresh server read still matches.
    if (!retry && !busy && !leftWindow) {
      const ticket = ++readTicket.current;
      const started = { revision: cartRevision(), generation: generation.current };
      void readVerifiedContext(ticket, started).then((next) => {
        if (!active || ticket !== readTicket.current || !next) return;
        identityRef.current = "verified";
        setIdentity("verified");
        if (sameCheckoutCart(initialCart.current, next.cart)) {
          staleRef.current = false;
          setStale(false);
        }
      }).catch(() => {
        if (active && ticket === readTicket.current) setError("بررسی حساب و سبد انجام نشد. دوباره تلاش کنید.");
      }).finally(() => {
        if (active && ticket === readTicket.current) setChecking(false);
      });
    } else setChecking(false);
    return () => {
      active = false;
      readTicket.current += 1;
      window.removeEventListener("shahoo-cart", onChange);
      window.removeEventListener("shahoo-cart-write", onWrite);
      window.removeEventListener("shahoo-cart-retry", onRetry);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [invalidate, readVerifiedContext, unverifyIdentity]);

  async function refreshCart() {
    if (identityRef.current === "changed") return;
    const busyNow = cartWritePending();
    const retryNow = cartIntentsBlockCheckout();
    if (busyNow || retryNow) {
      setCartPending(busyNow);
      setHasRetry(retryNow);
      invalidate();
      return;
    }
    if (checking || submitting.current) return;
    unverifyIdentity();
    const ticket = ++readTicket.current;
    const started = { revision: cartRevision(), generation: generation.current };
    setChecking(true);
    setError("");
    try {
      const next = await readVerifiedContext(ticket, started);
      if (ticket !== readTicket.current || !next) return;
      setCart(next.cart);
      identityRef.current = "verified";
      setIdentity("verified");
      staleRef.current = false;
      setStale(false);
    } catch {
      if (ticket === readTicket.current) setError("بررسی حساب و تازه‌سازی سبد انجام نشد. دوباره تلاش کنید.");
    } finally {
      if (ticket === readTicket.current) setChecking(false);
    }
  }

  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (identity !== "verified" || stale || !shippingMethodId || cart.lines.length === 0) return;
    let cancelled = false;
    const started = { revision: cartRevision(), generation: generation.current };
    const timer = window.setTimeout(() => {
      const busyNow = cartWritePending();
      const retryNow = cartIntentsBlockCheckout();
      if (busyNow || retryNow || staleRef.current || identityRef.current !== "verified") {
        setCartPending(busyNow);
        setHasRetry(retryNow);
        invalidate();
        return;
      }
      void quoteCheckoutFn({ data: { shippingMethodId, couponCode, province, city } })
        .then((result) => {
          if (cancelled || staleRef.current) return;
          const busyAfterRead = cartWritePending();
          const retryAfterRead = cartIntentsBlockCheckout();
          if (!checkoutReadIsCurrent(started, { revision: cartRevision(), generation: generation.current, pending: busyAfterRead, retry: retryAfterRead }) || result.subtotalIrr !== cart.subtotalIrr) {
            setCartPending(busyAfterRead);
            setHasRetry(retryAfterRead);
            invalidate();
            return;
          }
          setQuote({ result, cart, method: shippingMethodId, coupon: couponCode });
        })
        .catch(() => {
          if (!cancelled && !staleRef.current) setQuoteError("محاسبه مبلغ از سرور انجام نشد. دوباره تلاش کنید.");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [shippingMethodId, couponCode, province, city, cart, identity, stale, quoteAttempt, invalidate]);

  const currentQuote = identity === "verified" && !stale && quote && quote.cart === cart && quote.method === shippingMethodId && quote.coupon === couponCode ? quote.result : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const cartExpectation = checkoutCartExpectation(cart, initialOwner.current);
    const busyNow = cartWritePending();
    const retryNow = cartIntentsBlockCheckout();
    if (busyNow || retryNow) {
      setCartPending(busyNow);
      setHasRetry(retryNow);
      invalidate();
    }
    if (submitting.current || identityRef.current !== "verified" || staleRef.current || checking || busyNow || retryNow || !cartExpectation || !shippingMethodId || !currentQuote) {
      setError("پیش از ثبت، تغییرات سبد را تعیین تکلیف کنید و سبد و مبلغ سفارش را دوباره بررسی کنید.");
      return;
    }
    submitting.current = true;
    ownWrite.current = true;
    const release = beginCartWrite();
    if (!release) {
      ownWrite.current = false;
      submitting.current = false;
      setError("تغییر سبد هنوز در حال انجام است. پس از پایان آن سبد را بررسی کنید.");
      return;
    }
    if (identityRef.current !== "verified" || staleRef.current || cartIntentsBlockCheckout()) {
      release();
      ownWrite.current = false;
      submitting.current = false;
      setHasRetry(cartIntentsBlockCheckout());
      invalidate();
      setError("پیش از ثبت، تغییرات سبد را تعیین تکلیف کنید و دوباره بررسی کنید.");
      return;
    }
    setPending(true);
    let succeeded = false;
    try {
      const result = await placeOrderFn({
        data: {
          fullName,
          mobile,
          province,
          city,
          addressLine,
          postalCode,
          plaque,
          unit,
          customerNote,
          shippingMethodId,
          couponCode,
          idempotencyKey: checkoutKey(),
          addressId: addressId || null,
          cartExpectation,
        },
      });
      if (!result.ok) {
        if (result.code === "cart_changed") invalidate();
        if (result.code === "owner_changed") requireReload();
        setError(result.message);
        return;
      }
      if (paymentMethod === "payping") {
        let intent;
        try {
          intent = await initiatePayPingPaymentFn({ data: { orderId: result.orderId, idempotencyKey: checkoutKey() } });
        } catch {
          succeeded = true;
          notifyCart(0);
          window.location.assign(`/order/${result.publicCode}`);
          return;
        }
        succeeded = true;
        try { sessionStorage.removeItem("shahoo-checkout-key"); } catch { /* The payment attempt is already durable. */ }
        window.location.assign(intent.redirectUrl);
        return;
      }
      succeeded = true;
      try { sessionStorage.removeItem("shahoo-checkout-key"); } catch { /* The order is already registered. */ }
      notifyCart(0);
      window.location.assign(`/order/${result.publicCode}`);
    } catch {
      setPriorAttempt(true);
      setError("نتیجه ثبت سفارش مشخص نیست و ممکن است سفارش قبلاً ثبت شده باشد. پیش از تلاش دوباره وضعیت سفارش را بررسی کنید.");
    } finally {
      release();
      ownWrite.current = false;
      submitting.current = false;
      if (!succeeded) setPending(false);
    }
  }

  const savedLocked = addressId !== "";
  if (identity === "changed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-forest">حساب کاربری تغییر کرده است</h1>
        <p className="mt-4 text-sm leading-8">برای جلوگیری از نمایش اطلاعات نشانی و سفارش قبلی در نشست تازه، این صفحه را کامل بارگذاری دوباره کنید. اطلاعات واردشده در این فرم پاک نمی‌شود مگر اینکه صفحه را ترک کنید.</p>
        <button type="button" className={`${buttonPrimary} mt-5`} onClick={() => window.location.reload()}>بارگذاری دوباره صفحه</button>
      </div>
    );
  }
  if (identity !== "verified") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-forest">تأیید نشست تسویه</h1>
        <p className="mt-4 text-sm leading-8" role="status">برای محافظت از اطلاعات حساب و نشانی، جزئیات تسویه تا تأیید نشست پنهان است.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-forest">{error}</p> : null}
        <button type="button" className={`${buttonGhost} mt-4 disabled:opacity-50`} disabled={checking || cartPending || hasRetry} onClick={() => void refreshCart()}>
          {checking ? "در حال بررسی نشست..." : "بررسی دوباره نشست و سبد"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className={pageKicker}>SHAHOO</p>
          <h1 className={pageTitle}>تسویه حساب</h1>
          <p className="mt-2 text-sm leading-8 text-muted">
            سفارش با وضعیت «در انتظار پرداخت» ثبت می‌شود و موجودی تا ۲۴ ساعت کنار گذاشته می‌شود. {initial.paypingEnabled ? "با انتخاب پرداخت آنلاین، به پی‌پینگ هدایت می‌شوید." : "برای پیگیری، کد سفارش را نگه دارید و از راه‌های تماس فروشگاه استفاده کنید."}
          </p>
        </div>
        {checking || stale || cartPending || hasRetry ? (
          <div role="status" className="rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7 text-forest">
            {checking ? <p>در حال بررسی سبد خرید...</p> : null}
            {cartPending ? <p>تغییر سبد در حال انجام است؛ تا پایان آن ثبت سفارش ممکن نیست.</p> : null}
            {hasRetry ? <p>وضعیت یک تغییر سبد یا ذخیره‌سازی نشست نیاز به بررسی دارد. سبد بالای صفحه را باز کنید و هشدار آن را تعیین تکلیف کنید.</p> : null}
            {stale && !checking ? <p>سبد نمایش‌داده‌شده نیاز به تازه‌سازی و بررسی دوباره دارد. اطلاعات واردشده در فرم حفظ می‌شود.</p> : null}
            {stale ? <button type="button" className={`${buttonGhost} mt-3 disabled:opacity-50`} disabled={checking || cartPending || hasRetry || pending} onClick={() => void refreshCart()}>تازه‌سازی سبد و بررسی سفارش</button> : null}
          </div>
        ) : null}
        {cart.lines.length === 0 && !stale ? (
          <div className="rounded-2xl border border-line bg-paper p-4 text-sm leading-7">
            <p>سبد خالی است و سفارشی ساخته نمی‌شود. اطلاعات فرم تا زمانی که در این صفحه بمانید حفظ می‌شود.</p>
            <Link to="/products" className={`mt-3 ${buttonGhost}`}>رفتن به محصولات</Link>
          </div>
        ) : null}
        <section className={`${panelClass} space-y-4 p-5`}>
          <h2 className="font-bold text-forest">گیرنده</h2>
          <Field label="نام و نام خانوادگی" value={fullName} onChange={setFullName} readOnly={recipientNameLocked} />
          <label className="block text-sm font-bold text-forest">
            موبایل
            <input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              readOnly={Boolean(selectedAddress?.recipientMobile) || Boolean(initial.account)}
              inputMode="tel"
              dir="ltr"
              className={`${fieldClass} mt-2 text-left`}
            />
          </label>
          {selectedAddress?.recipientName || selectedAddress?.recipientMobile ? <p className="text-xs text-muted">اطلاعات گیرنده مطابق نشانی ذخیره‌شده ثبت می‌شود.</p> : initial.account ? <p className="text-xs text-muted">شماره از حساب واردشده گرفته می‌شود.</p> : null}
        </section>
        <section className={`${panelClass} space-y-4 p-5`}>
          <h2 className="font-bold text-forest">نشانی</h2>
          {initial.addresses.length > 0 ? (
            <label className="block text-sm font-bold text-forest">
              نشانی ذخیره‌شده
              <select
                value={addressId}
                onChange={(event) => {
                  const id = event.target.value;
                  setAddressId(id);
                  const saved = initial.addresses.find((item) => item.id === id);
                  setFullName(saved?.recipientName || original.account?.fullName || "");
                  setMobile(saved?.recipientMobile || original.account?.mobile || "");
                  if (!saved) {
                    setProvince("");
                    setCity("");
                    setAddressLine("");
                    setPostalCode("");
                    setPlaque("");
                    setUnit("");
                    return;
                  }
                  setProvince(saved.province);
                  setCity(saved.city);
                  setAddressLine(saved.addressLine);
                  setPostalCode(saved.postalCode);
                  setPlaque(saved.plaque);
                  setUnit(saved.unit);
                }}
                className={`${fieldClass} mt-2`}
              >
                <option value="">نوشتن نشانی تازه</option>
                {initial.addresses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label || item.city} {item.isDefault ? "· پیش‌فرض" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {savedLocked ? (
            <p className="text-xs leading-6 text-muted">
              نشانی ذخیره‌شده انتخاب شده است. فیلدهای نشانی فقط خواندنی‌اند و همان متن روی سفارش ثبت می‌شود.
            </p>
          ) : (
            <p className="text-xs leading-6 text-muted">نشانی تازه‌ای که در همین فرم می‌بینید روی سفارش ثبت می‌شود.</p>
          )}
          <label className="block text-sm font-bold text-forest">
            استان
            <select
              value={province}
              onChange={(event) => {
                const nextProv = event.target.value;
                setProvince(nextProv);
                const availableCities = getCitiesForProvince(nextProv);
                if (availableCities.length > 0 && !availableCities.includes(city)) {
                  setCity(availableCities[0] ?? "");
                }
              }}
              disabled={savedLocked}
              className={`${fieldClass} mt-2`}
            >
              <option value="">انتخاب استان...</option>
              {IRAN_PROVINCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {province && getCitiesForProvince(province).length > 0 ? (
            <label className="block text-sm font-bold text-forest">
              شهر
              <select
                value={getCitiesForProvince(province).includes(city) ? city : (city ? "__other__" : "")}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "__other__") {
                    setCity("");
                  } else {
                    setCity(val);
                  }
                }}
                disabled={savedLocked}
                className={`${fieldClass} mt-2`}
              >
                <option value="">انتخاب شهر از لیست...</option>
                {getCitiesForProvince(province).map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))}
                <option value="__other__">سایر شهرها / تایپ دستی</option>
              </select>
            </label>
          ) : null}
          {(!province || !getCitiesForProvince(province).includes(city)) ? (
            <Field label="نام شهر (تایپ دستی)" value={city} onChange={setCity} readOnly={savedLocked} />
          ) : null}
          <Field label="نشانی" value={addressLine} onChange={setAddressLine} readOnly={savedLocked} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="کد پستی" value={postalCode} onChange={setPostalCode} ltr readOnly={savedLocked} />
            <Field label="پلاک" value={plaque} onChange={setPlaque} readOnly={savedLocked} />
            <Field label="واحد" value={unit} onChange={setUnit} readOnly={savedLocked} />
          </div>
          <Field label="توضیح برای ارسال" value={customerNote} onChange={setCustomerNote} />
        </section>
        <fieldset className={`${panelClass} space-y-3 p-5`}>
          <legend className="font-bold text-forest">روش ارسال</legend>
          {availableMethods.length === 0 ? (
            <p className="text-sm leading-7 text-muted">برای مقصد فعلی روش ارسال فعالی وجود ندارد. استان و شهر را بررسی کنید.</p>
          ) : (
            availableMethods.map((method) => (
              <label key={method.id} className="flex min-h-11 items-start gap-3 text-sm leading-7">
                <input
                  type="radio"
                  name="shipping"
                  className="mt-2"
                  checked={shippingMethodId === method.id}
                  onChange={() => setShippingMethodId(method.id)}
                />
                <span>
                  <span className="font-bold text-forest">{method.title}</span>
                  <span className="mt-1 block text-muted">{method.description}</span>
                </span>
              </label>
            ))
        )}
        </fieldset>
        {initial.paypingEnabled ? (
          <fieldset className={`${panelClass} space-y-3 p-5`}>
            <legend className="font-bold text-forest">روش پرداخت</legend>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-7">
              <input type="radio" name="payment" className="mt-2" checked={paymentMethod === "manual"} onChange={() => setPaymentMethod("manual")} />
              <span><span className="font-bold text-forest">ثبت سفارش و پرداخت بعدی</span><span className="mt-1 block text-muted">سفارش پرداخت‌نشده ثبت می‌شود.</span></span>
            </label>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-7">
              <input type="radio" name="payment" className="mt-2" checked={paymentMethod === "payping"} onChange={() => setPaymentMethod("payping")} />
              <span><span className="font-bold text-forest">پرداخت آنلاین با پی‌پینگ</span><span className="mt-1 block text-muted">مبلغ نهایی فقط از سمت سرور محاسبه می‌شود و سپس به درگاه هدایت خواهید شد.</span></span>
            </label>
          </fieldset>
        ) : null}
        {error ? (
          <p className="text-sm font-bold text-forest" role="alert">
            {error}
          </p>
        ) : null}
        {quoteError && !stale ? (
          <div role="alert" className="text-sm text-forest">
            <p>{quoteError}</p>
            <button type="button" className={`${buttonGhost} mt-2`} onClick={() => setQuoteAttempt((attempt) => attempt + 1)}>تلاش دوباره برای محاسبه مبلغ</button>
          </div>
        ) : null}
        {priorAttempt ? <p className="text-sm leading-7 text-forest" role="status">یک تلاش قبلی ممکن است ثبت شده باشد. تلاش دوباره با همان کلید، در صورت ثبت قبلی، همان سفارش پیشین را باز می‌کند؛ حتی اگر سبد اکنون تغییر کرده باشد.</p> : null}
        <button type="submit" className={`${buttonPrimary} disabled:opacity-50`} disabled={pending || checking || stale || cartPending || hasRetry || !cart.cartId || cart.lines.length === 0 || !shippingMethodId || !currentQuote}>
          {pending ? "در حال ثبت" : paymentMethod === "payping" ? "ثبت سفارش و پرداخت آنلاین" : "ثبت سفارش پرداخت‌نشده"}
        </button>
      </form>
      <aside className={`${panelClass} h-fit border-gold/40 p-5 lg:sticky lg:top-24`}>
        <h2 className="font-bold text-forest">خلاصه</h2>
        {stale ? <p className="mt-2 text-xs text-muted">این خلاصه ممکن است قدیمی باشد؛ پس از تازه‌سازی آن را بررسی کنید.</p> : null}
        {!stale && cart.lines.length > 0 ? <p className="mt-2 text-xs leading-6 text-muted">پیش از ثبت، کالاها، تعداد، قیمت واحد و مبلغ نهایی را بررسی کنید.</p> : null}
        <ul className="mt-4 space-y-3 text-sm">
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex justify-between gap-3">
              <span>
                {line.name}
                <span className="block text-xs text-muted">
                  {line.label} · {toPersianNum(line.quantity)}
                </span>
                <span className="block text-xs text-muted">قیمت واحد: {formatTomanFromIrr(line.unitPriceIrr)}</span>
              </span>
              <span className="tabular-nums">{formatTomanFromIrr(line.lineTotalIrr)}</span>
            </li>
          ))}
        </ul>
        <label className="mt-5 block text-sm font-bold text-forest">
          کد تخفیف
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
            dir="ltr"
            className={`${fieldClass} mt-2 text-left`}
            placeholder="SHAHOO10"
          />
        </label>
        {currentQuote?.couponMessage ? <p className="mt-2 text-xs leading-6 text-muted">{currentQuote.couponMessage}</p> : null}
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="کالا" value={stale ? "نیاز به بررسی" : formatTomanFromIrr(cart.subtotalIrr)} />
          <Row label="تخفیف" value={currentQuote ? formatTomanFromIrr(currentQuote.discountIrr) : "در انتظار محاسبه"} />
          <Row label="ارسال" value={initial.methods.length === 0 ? "تنظیم نشده" : currentQuote ? formatTomanFromIrr(currentQuote.shippingIrr) : "در انتظار محاسبه"} />
          <Row label="قابل پرداخت" value={currentQuote ? formatTomanFromIrr(currentQuote.totalIrr) : "در انتظار محاسبه"} strong />
        </dl>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ltr = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ltr?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-forest">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        dir={ltr ? "ltr" : undefined}
        className={`${fieldClass} mt-2 ${ltr ? "text-left" : ""} ${readOnly ? "bg-cream text-muted" : ""}`}
      />
    </label>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold text-forest" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function checkoutKey(): string {
  const existing = sessionStorage.getItem("shahoo-checkout-key");
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem("shahoo-checkout-key", key);
  return key;
}

function cartIntentsBlockCheckout(): boolean {
  return checkoutIntentsBlocked(getCartIntents());
}
