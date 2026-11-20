import type { CartSnapshot } from "@/lib/commerce-types";
import { toPersianNum } from "@/lib/format";
import { clearCartAdd, clearCartRetry, type CartIntentState, type CartRetry } from "./cart-client";
import { buttonGhost, buttonPrimary } from "./ui";

export function CartIntentNotices({ state, cart, busy, loading, loadFailed, addReviewReady, onRetry, onDiscard }: {
  state: CartIntentState | null;
  cart: CartSnapshot | null;
  busy: boolean;
  loading: boolean;
  loadFailed: boolean;
  addReviewReady: boolean;
  onRetry: (retry: CartRetry) => void;
  onDiscard: () => void;
}) {
  if (!state) return null;
  const retry = state.retry;
  const matches = !!retry && !!cart?.cartId && retry.expectedCartId === cart.cartId && !loading && !loadFailed;
  const currentQuantity = matches ? (cart?.lines.find((line) => line.variantId === retry?.variantId)?.quantity ?? 0) : null;
  const canRepeat = matches && currentQuantity === retry?.expectedQuantity;
  return <div className="space-y-3">
    {!state.storageAvailable ? <p role="alert" className="rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7">ذخیره‌سازی نشست مرورگر در دسترس نیست. برای جلوگیری از ثبت تکراری، تغییر سبد و افزودن کالا غیرفعال است؛ دسترسی به ذخیره‌سازی را فعال و صفحه را تازه کنید.</p> : null}
    {state.retryInvalid ? <div role="alert" className="rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7">
      <p>اطلاعات یک تغییر قدیمی خوانا نیست و بدون بررسی پاک نمی‌شود. برای ادامه می‌توانید صریحاً از آن صرف‌نظر کنید.</p>
      <button type="button" disabled={busy || !state.storageAvailable} className={`${buttonGhost} mt-2 disabled:opacity-50`} onClick={() => { if (clearCartRetry()) onDiscard(); }}>صرف‌نظر از تغییر ناخوانا</button>
    </div> : null}
    {retry ? <div role="alert" className="rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7">
      {matches ? <><p>{retry.text}</p><p>تغییر تأییدنشده: {retry.name}، {retry.quantity === 0 ? "حذف از سبد" : `تعداد ${toPersianNum(retry.quantity)}`}.</p><p>ممکن است تغییر قبلی ثبت شده باشد؛ سبد تازه را بررسی کنید.</p>{!canRepeat ? <p>تعداد فعلی با مقدار قبلی متفاوت است؛ از تغییر صرف‌نظر کنید و در صورت نیاز دوباره انتخاب کنید.</p> : null}</> : <p>یک تغییر تأییدنشده وجود دارد. برای بررسی آن سبد مربوط به همان نشست را باز کنید یا از تغییر صرف‌نظر کنید.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !state.storageAvailable || !canRepeat} className={`${buttonPrimary} disabled:opacity-50`} onClick={() => onRetry(retry)}>ثبت دوباره تغییر</button>
        <button type="button" disabled={busy || !state.storageAvailable} className={`${buttonGhost} disabled:opacity-50`} onClick={() => { if (clearCartRetry()) onDiscard(); }}>صرف‌نظر از تغییر</button>
      </div>
    </div> : null}
    {state.addPending ? <div role="alert" className="rounded-2xl border border-gold/40 bg-cream p-4 text-sm leading-7">
      <p>نتیجه افزودن قبلی نامشخص است و ممکن است با تأخیر ثبت شود. افزودن دوباره خودکار انجام نمی‌شود. پس از اطمینان از پایان درخواست، سبد تازه زیر را بررسی و برای ادامه تأیید کنید. اگر نشست عوض شده، نتیجه ممکن است در سبد قبلی باشد.</p>
      <button type="button" disabled={busy || loading || loadFailed || !addReviewReady || !state.storageAvailable} className={`${buttonGhost} mt-2 disabled:opacity-50`} onClick={() => { if (clearCartAdd()) onDiscard(); }}>سبد تازه را بررسی کردم؛ ادامه</button>
    </div> : null}
  </div>;
}
