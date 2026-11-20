import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CartSnapshot } from "@/lib/commerce-types";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { getCart, setCartItemFn } from "@/server/commerce/api";
import { CART_READ_FAILED, clampDraftQuantity, createLatestGate } from "@/lib/cart-ui-rules";
import { adoptBrowserCartOnce, beginCartWrite, bypassBrowserCart, cartRevision, cartWritePending, clearCartRetry, getCartIntents, notifyCart, sameCartIntent, setCartRetry } from "./cart-client";
import { CartIntentNotices } from "./cart-intent-notices";
import { useCartIntents } from "./use-cart-intents";
import { CART_SET_UNCERTAIN } from "./cart-intents";
import { buttonGhost, buttonPrimary, pageKicker, pageTitle, panelClass } from "./ui";

export function CartView() {
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const intents = useCartIntents();
  const [addReviewReady, setAddReviewReady] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const gate = useRef(createLatestGate());
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const ticket = gate.current.next();
    if (cartWritePending()) return;
    const revision = cartRevision();
    setLoading(true);
    setLoadFailed(false);
    setAddReviewReady(false);
    try {
      await adoptBrowserCartOnce();
      const next = await getCart();
      if (!gate.current.isLatest(ticket) || revision !== cartRevision()) return;
      setCart(next);
      setDraftRevision((value) => value + 1);
      setAddReviewReady(getCartIntents().addPending);
    } catch {
      if (gate.current.isLatest(ticket) && revision === cartRevision()) setLoadFailed(true);
    } finally {
      if (gate.current.isLatest(ticket) && revision === cartRevision()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const activeGate = gate.current;
    setBusy(cartWritePending());
    const onChange = () => {
      gate.current.next();
      if (!cartWritePending()) void load();
    };
    const onWrite = () => {
      const pending = cartWritePending();
      setBusy(pending);
      gate.current.next();
      if (pending) { setLoading(false); setAddReviewReady(false); }
      if (!pending) void load();
    };
    const onFocus = () => {
      setCart(null);
      setAddReviewReady(false);
      if (!cartWritePending()) void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        gate.current.next();
        setCart(null);
        setAddReviewReady(false);
        setLoading(true);
      } else onFocus();
    };
    window.addEventListener("shahoo-cart", onChange);
    window.addEventListener("shahoo-cart-write", onWrite);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    void load();
    return () => {
      activeGate.next();
      window.removeEventListener("shahoo-cart", onChange);
      window.removeEventListener("shahoo-cart-write", onWrite);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  async function update(variantId: string, quantity: number, name: string, expectedCartId: string, expectedQuantity: number) {
    if (!expectedCartId || loading || loadFailed || !cart || cart.cartId !== expectedCartId) return;
    const current = getCartIntents();
    const proposed = { variantId, quantity, name, expectedCartId, expectedQuantity, text: CART_SET_UNCERTAIN };
    if (!current.storageAvailable || current.addPending || current.retryInvalid ||
      (current.retry && !sameCartIntent(current.retry, proposed)) ||
      (cart.lines.find((line) => line.variantId === variantId)?.quantity ?? 0) !== expectedQuantity) return;
    if (busyRef.current) return; // one cart change at a time: no duplicate or out-of-order writes
    const release = beginCartWrite();
    if (!release) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    const ticket = gate.current.next();
    try {
      if (!setCartRetry(current.retry ?? proposed)) return;
      const result = await setCartItemFn({ data: { variantId, quantity, expectedCartId, expectedQuantity } });
      if (gate.current.isLatest(ticket)) { setCart(result.cart); setDraftRevision((value) => value + 1); }
      if (result.ok) clearCartRetry();
      else setCartRetry({ ...proposed, text: result.message ?? "تغییر سبد انجام نشد. دوباره تلاش کنید." });
      if (result.ok && result.message) setMessage({ text: result.message, error: false });
      notifyCart(result.cart.count);
    } catch {
      setCartRetry({ variantId, quantity, name, expectedCartId, expectedQuantity, text: CART_SET_UNCERTAIN });
    } finally {
      busyRef.current = false;
      release();
      setBusy(false);
    }
  }

  const lines = cart?.lines ?? [];
  const unavailable = busy || loading || loadFailed || !intents || !intents.storageAvailable || !!intents.retry || intents.retryInvalid || intents.addPending || !cart?.cartId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={pageTitle}>سبد خرید</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
        سبد روی پایگاه داده نگه داشته می‌شود. مهمان با یک نشست مرورگر، و مشتری واردشده با حساب خودش. قیمت همین حالا از سرور خوانده می‌شود.
      </p>
      {message ? (
        <p className="mt-4 text-sm font-bold text-forest" role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
      <div className="mt-3"><CartIntentNotices state={intents} cart={cart} busy={busy} loading={loading} loadFailed={loadFailed} addReviewReady={addReviewReady} onRetry={(retry) => void update(retry.variantId, retry.quantity, retry.name, retry.expectedCartId, retry.expectedQuantity)} onDiscard={() => { setMessage(null); setDraftRevision((value) => value + 1); void load(); }} /></div>
      {!cart && !loadFailed ? (
        <p className="mt-6 text-sm" role="status">
          در حال خواندن سبد...
        </p>
      ) : null}
      {loadFailed ? (
        <div className={`${panelClass} mt-6 p-6`} role="alert">
          <p className="text-sm">{CART_READ_FAILED}</p>
          <button type="button" className={`mt-4 ${buttonGhost}`} onClick={() => void load()}>
            تلاش دوباره
          </button>
          <button type="button" className={`mt-4 ${buttonGhost}`} onClick={() => { bypassBrowserCart(); void load(); }}>نمایش سبد سرور بدون انتقال سبد قدیمی (داده قدیمی حفظ می‌شود)</button>
        </div>
      ) : null}
      {cart && !loading && !loadFailed && lines.length === 0 ? (
        <div className={`${panelClass} mt-6 p-8`}>
          <p>سبد خالی است.</p>
          <Link to="/products" className={`mt-4 ${buttonPrimary}`}>
            رفتن به محصولات
          </Link>
        </div>
      ) : null}
      {!loading && !loadFailed && lines.length > 0 ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.variantId} className={`${panelClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to="/product/$productId" params={{ productId: line.slug }} className="font-bold text-forest">
                      {line.name}
                    </Link>
                    <p className="text-sm text-muted">{line.label}</p>
                    <p className="mt-1 text-sm tabular-nums">{formatTomanFromIrr(line.unitPriceIrr)}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-forest">{formatTomanFromIrr(line.lineTotalIrr)}</p>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <QuantityField line={line} busy={unavailable} resetVersion={draftRevision} onCommit={(quantity) => void update(line.variantId, quantity, line.name, cart?.cartId ?? "", line.quantity)} />
                  <button
                    type="button"
                    className="min-h-11 text-sm font-bold text-forest disabled:opacity-50"
                    disabled={unavailable}
                    aria-label={`حذف ${line.name} از سبد`}
                    onClick={() => void update(line.variantId, 0, line.name, cart?.cartId ?? "", line.quantity)}
                  >
                    حذف
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">قابل فروش: {toPersianNum(line.sellable)}</p>
              </li>
            ))}
          </ul>
          {cart ? (
            <aside className="h-fit rounded-3xl border border-gold/40 bg-cream p-5 lg:sticky lg:top-24">
              <h2 className="font-bold text-forest">جمع سبد</h2>
              <p className="mt-4 flex justify-between text-sm font-bold">
                <span>جمع کالا</span>
                <span className="tabular-nums">{formatTomanFromIrr(cart.subtotalIrr)}</span>
              </p>
              <p className="mt-2 text-xs leading-6 text-muted">هزینه ارسال و کد تخفیف در تسویه حساب، دوباره روی سرور حساب می‌شود. پرداخت آنلاین هنوز وصل نیست.</p>
              {unavailable ? <button type="button" disabled className={`mt-4 w-full opacity-50 ${buttonPrimary}`}>ادامه به تسویه</button> : <Link to="/checkout" className={`mt-4 w-full ${buttonPrimary}`}>ادامه به تسویه</Link>}
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuantityField({
  line,
  busy,
  resetVersion,
  onCommit,
}: {
  line: CartSnapshot["lines"][number];
  busy: boolean;
  resetVersion: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(line.quantity));
  useEffect(() => setDraft(String(line.quantity)), [line.quantity, resetVersion]);

  function commit() {
    if (busy) return;
    const quantity = clampDraftQuantity(draft, line.sellable);
    setDraft(String(quantity));
    if (quantity !== line.quantity) onCommit(quantity);
  }

  return (
    <label className="text-sm">
      تعداد
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(1, Math.min(20, line.sellable))}
        value={draft}
        disabled={busy}
        aria-label={`تعداد ${line.name}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="ms-2 h-11 w-20 rounded-xl border border-line bg-ivory px-3 disabled:opacity-60"
      />
    </label>
  );
}
