import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CartSnapshot } from "@/lib/commerce-types";
import { createLatestGate, CART_READ_FAILED } from "@/lib/cart-ui-rules";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { isShopImage } from "@/lib/media-bytes";
import { getCart, setCartItemFn } from "@/server/commerce/api";
import { adoptBrowserCartOnce, beginCartWrite, bypassBrowserCart, cartRevision, cartWritePending, clearCartRetry, getCartIntents, notifyCart, sameCartIntent, setCartRetry } from "./cart-client";
import { CartIntentNotices } from "./cart-intent-notices";
import { useCartIntents } from "./use-cart-intents";
import { CART_SET_UNCERTAIN } from "./cart-intents";
import { buttonGhost, buttonPrimary } from "./ui";

type CartChange = { variantId: string; quantity: number; name: string; expectedCartId: string; expectedQuantity: number };
const iconButton = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-forest transition hover:border-gold hover:bg-gold/15 active:bg-gold/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40";

function CartImage({ url }: { url?: string }) {
  const [broken, setBroken] = useState(false);
  if (url && isShopImage(url) && !broken) {
    return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-20 w-20 shrink-0 rounded-xl bg-cream object-cover" />;
  }
  return <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-cream text-forest" role="img" aria-label="تصویر محصول در دسترس نیست"><ShoppingBag className="h-7 w-7" /></div>;
}

export function CartDrawer({ count, pathname, onOpen, onCount }: { count: number | null; pathname: string; onOpen: () => void; onCount: (count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const intents = useCartIntents();
  const [addReviewReady, setAddReviewReady] = useState(false);
  const gate = useRef(createLatestGate());

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
      if (gate.current.isLatest(ticket) && revision === cartRevision()) {
        setCart(next);
        onCount(next.count);
        setAddReviewReady(getCartIntents().addPending);
      }
    } catch {
      if (gate.current.isLatest(ticket) && revision === cartRevision()) setLoadFailed(true);
    } finally {
      if (gate.current.isLatest(ticket) && revision === cartRevision()) setLoading(false);
    }
  }, [onCount]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
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
      else void load();
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
  }, [open, load]);

  async function change(intent: CartChange) {
    if (!intent.expectedCartId || loading || loadFailed || !cart || cart.cartId !== intent.expectedCartId) return;
    const current = getCartIntents();
    const proposed = { ...intent, text: CART_SET_UNCERTAIN };
    if (!current.storageAvailable || current.addPending || current.retryInvalid ||
      (current.retry && !sameCartIntent(current.retry, proposed)) ||
      (cart.lines.find((line) => line.variantId === intent.variantId)?.quantity ?? 0) !== intent.expectedQuantity) return;
    const release = beginCartWrite();
    if (!release) return;
    setBusy(true);
    setMessage(null);
    const ticket = gate.current.next();
    try {
      if (!setCartRetry(current.retry ?? proposed)) return;
      const result = await setCartItemFn({ data: { variantId: intent.variantId, quantity: intent.quantity, expectedCartId: intent.expectedCartId, expectedQuantity: intent.expectedQuantity } });
      if (gate.current.isLatest(ticket)) setCart(result.cart);
      if (result.ok) {
        clearCartRetry();
        if (result.message) setMessage({ text: result.message, error: false });
      } else {
        setCartRetry({ ...intent, text: result.message ?? "تغییر سبد انجام نشد. دوباره تلاش کنید." });
      }
      // This also tells the standalone cart and header to refresh; the final read runs after release.
      notifyCart(result.cart.count);
    } catch {
      setCartRetry({ ...intent, text: CART_SET_UNCERTAIN });
    } finally {
      release();
      setBusy(false);
    }
  }

  const unavailable = busy || loading || loadFailed || !intents || !intents.storageAvailable || !!intents.retry || intents.retryInvalid || intents.addPending || !cart?.cartId;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpen();
          setCart(null);
          setLoadFailed(false);
          setLoading(true);
        }
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-forest bg-forest text-ivory transition hover:border-gold hover:bg-deep hover:text-gold-soft active:border-gold active:text-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          aria-label={count === null ? "باز کردن سبد خرید، تعداد نامشخص" : `باز کردن سبد خرید، ${toPersianNum(count)} کالا`}
        >
          <ShoppingBag className="h-5 w-5" />
          {count !== null && count > 0 ? <span aria-hidden="true" className="absolute -top-1 -start-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-deep">{toPersianNum(count)}</span> : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-deep/60" />
        <Dialog.Content dir="rtl" className="fixed inset-y-0 start-0 z-[61] flex h-[100dvh] w-full max-w-md flex-col bg-ivory text-ink shadow-2xl focus:outline-none sm:w-[28rem]">
          <div className="flex items-center justify-between gap-4 border-b border-gold/40 px-5 py-4">
            <div>
              <Dialog.Title className="text-xl font-bold text-forest">سبد خرید</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">قیمت و موجودی از سرور بررسی می‌شوند.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className={iconButton} aria-label="بستن سبد خرید"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {loading || (busy && !cart) ? <p role="status" className="mb-4 text-sm text-muted">در حال بررسی سبد خرید...</p> : null}
            {loadFailed ? (
              <div role="alert" className="mb-4 rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7">
                <p>{CART_READ_FAILED}</p>
                <button type="button" className={`${buttonGhost} mt-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`} onClick={() => void load()}>تلاش دوباره</button>
                <button type="button" className={`${buttonGhost} mt-3`} onClick={() => { bypassBrowserCart(); void load(); }}>نمایش سبد سرور بدون انتقال سبد قدیمی (داده قدیمی حفظ می‌شود)</button>
              </div>
            ) : null}
            {message ? <p role={message.error ? "alert" : "status"} className="mb-4 rounded-2xl bg-cream p-3 text-sm leading-7 text-forest">{message.text}</p> : null}
            <div className="mb-4"><CartIntentNotices state={intents} cart={cart} busy={busy} loading={loading} loadFailed={loadFailed} addReviewReady={addReviewReady} onRetry={(retry) => void change(retry)} onDiscard={() => { setMessage(null); void load(); }} /></div>
            {cart && !loading && !loadFailed && cart.lines.length === 0 ? <p className="rounded-2xl border border-line bg-paper p-5 text-sm">سبد خرید شما خالی است.</p> : null}
            {cart && !loading && !loadFailed && cart.lines.length > 0 ? (
              <ul className="space-y-4" aria-busy={busy || loading}>
                {cart.lines.map((line) => (
                  <li key={line.variantId} className="rounded-2xl border border-line bg-paper p-3">
                    <div className="flex items-start gap-3">
                      <CartImage key={`${line.variantId}:${line.imageUrl ?? ""}`} url={line.imageUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-bold text-forest">{line.name}</p>
                        {line.label ? <p className="mt-1 text-xs text-muted">{line.label}</p> : null}
                        <p className="mt-2 text-xs tabular-nums">قیمت واحد: {formatTomanFromIrr(line.unitPriceIrr)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className={iconButton} aria-label={`کاهش تعداد ${line.name}`} disabled={unavailable || line.quantity <= 1} onClick={() => void change({ variantId: line.variantId, quantity: line.quantity - 1, name: line.name, expectedCartId: cart.cartId ?? "", expectedQuantity: line.quantity })}><Minus className="h-4 w-4" /></button>
                        <span className="min-w-8 text-center text-sm font-bold tabular-nums" aria-label={`تعداد ${line.name}: ${toPersianNum(line.quantity)}`}>{toPersianNum(line.quantity)}</span>
                        <button type="button" className={iconButton} aria-label={`افزایش تعداد ${line.name}`} disabled={unavailable || line.quantity >= Math.min(20, line.sellable)} onClick={() => void change({ variantId: line.variantId, quantity: line.quantity + 1, name: line.name, expectedCartId: cart.cartId ?? "", expectedQuantity: line.quantity })}><Plus className="h-4 w-4" /></button>
                        <button type="button" className="ms-1 min-h-11 rounded-full px-3 text-sm font-bold text-forest transition hover:bg-gold/15 active:bg-gold/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40" disabled={unavailable} aria-label={`حذف ${line.name} از سبد`} onClick={() => void change({ variantId: line.variantId, quantity: 0, name: line.name, expectedCartId: cart.cartId ?? "", expectedQuantity: line.quantity })}>حذف</button>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-forest">جمع: {formatTomanFromIrr(line.lineTotalIrr)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-3 border-t border-gold/40 bg-cream p-5">
            {cart && !loading && !loadFailed ? <p className="flex items-center justify-between gap-3 text-sm font-bold text-forest"><span>جمع کالاها</span><span className="tabular-nums">{formatTomanFromIrr(cart.subtotalIrr)}</span></p> : null}
            <p className="text-xs leading-6 text-muted">هزینه ارسال و تخفیف در مرحله تسویه محاسبه می‌شود.</p>
            {cart && cart.lines.length > 0 && !unavailable ? <Link to="/checkout" className={`${buttonPrimary} w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`} onClick={() => setOpen(false)}>ادامه به تسویه</Link> : <button type="button" disabled className={`${buttonPrimary} w-full opacity-50`}>ادامه به تسویه</button>}
            <Link to="/cart" className={`${buttonGhost} w-full`} onClick={() => setOpen(false)}>مشاهده صفحه کامل سبد خرید</Link>
            <Dialog.Close asChild><button type="button" className={`${buttonGhost} w-full transition hover:border-gold hover:bg-gold/15 active:bg-gold/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}>ادامه خرید</button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
