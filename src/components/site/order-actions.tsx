import { useState } from "react";
import { useGuardedAction } from "./use-guarded-action";
import type { OrderView } from "@/lib/commerce-types";
import { orderStatusLabel } from "@/server/commerce/pricing";
import { moveOrderFn, requestReturnFn, settleCancelFn, shipmentFn } from "@/server/commerce/fulfillment-api";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";

export function OrderActions({ order }: { order: OrderView }) {
  const { pending, message, run } = useGuardedAction();
  const [reason, setReason] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="mt-4 space-y-3">
      {order.carrier || order.trackingCode ? (
        <p className={`${panelClass} p-4 text-sm`}>
          ارسال: {order.carrier || "شرکت حمل ثبت نشده"} {order.trackingCode ? `· رهگیری ${order.trackingCode}` : ""}
          {order.shipmentNote ? ` · ${order.shipmentNote}` : ""}
        </p>
      ) : null}
      {order.canSettleCancel ? (
        <div className={`${panelClass} space-y-3 p-4`}>
          <h2 className="font-bold text-forest">لغو سفارش پرداخت‌شده</h2>
          <p className="text-sm leading-7 text-muted">موجودی یک‌بار برمی‌گردد و مبلغ فقط در دفتر ثبت می‌شود. واریز بانکی انجام نمی‌شود.</p>
          <textarea className={fieldClass} aria-label="دلیل لغو سفارش پرداخت‌شده" value={actionReason} onChange={(event) => setActionReason(event.target.value)} minLength={2} maxLength={400} required rows={2} />
          <button
            type="button"
            className={buttonGhost}
            disabled={pending || actionReason.trim().length < 2}
            onClick={() => {
              if (actionReason.trim().length < 2) return;
              if (!window.confirm(`لغو و استرداد فقط در دفتر داخلی ثبت می‌شود؛ هیچ وجهی به درگاه برنمی‌گردد. دلیل: ${actionReason.trim()}. ادامه؟`)) return;
              void run(() => settleCancelFn({ data: { publicCode: order.publicCode, reason: actionReason } }), {
                failure: "بستن سفارش انجام نشد. وضعیت سفارش را تازه کنید و دوباره تلاش کنید.",
                onOk: () => window.location.reload(),
              });
            }}
          >
            ثبت استرداد داخلی و بستن سفارش
          </button>
        </div>
      ) : null}
      {order.canRequestReturn ? (
        <form
          className={`${panelClass} space-y-3 p-4`}
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => requestReturnFn({ data: { publicCode: order.publicCode, reason } }), {
              failure: "درخواست مرجوعی ثبت نشد. دوباره تلاش کنید.",
              success: "درخواست مرجوعی ثبت شد.",
            });
          }}
        >
          <h2 className="font-bold text-forest">درخواست مرجوعی</h2>
          <textarea className={fieldClass} aria-label="دلیل مرجوعی" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={400} required rows={3} />
          <button className={buttonPrimary} type="submit" disabled={pending || reason.trim().length < 8}>
            ثبت درخواست
          </button>
        </form>
      ) : null}
      {order.nextStatuses.length > 0 ? (
        <div className={`${panelClass} space-y-3 p-4`}>
          <h2 className="font-bold text-forest">تغییر وضعیت</h2>
          <label className="block text-sm font-bold text-forest">دلیل تغییر وضعیت<textarea className={`${fieldClass} mt-2`} aria-label="دلیل تغییر وضعیت" value={actionReason} onChange={(event) => setActionReason(event.target.value)} minLength={2} maxLength={400} rows={2} required /></label>
          <div className="flex flex-wrap gap-2">
            {order.nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={buttonGhost}
                disabled={pending || actionReason.trim().length < 2}
                onClick={() => {
                  if (actionReason.trim().length < 2) return;
                  if (!window.confirm(`وضعیت به «${orderStatusLabel(status)}» تغییر کند؟ دلیل: ${actionReason.trim()}`)) return;
                  void run(() => moveOrderFn({ data: { publicCode: order.publicCode, next: status, reason: actionReason } }), {
                    failure: "تغییر وضعیت انجام نشد. دوباره تلاش کنید.",
                    onOk: () => window.location.reload(),
                  });
                }}
              >
                {orderStatusLabel(status)}
              </button>
            ))}
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim().length < 2) return;
              if (!window.confirm(`ثبت/به‌روزرسانی ارسال برای ${carrier || "شرکت حمل"} با این دلیل انجام شود؟ دلیل: ${note.trim()}`)) return;
              void run(
                () => shipmentFn({ data: { publicCode: order.publicCode, carrier, trackingCode: tracking, note, handedOffAt: null } }),
                { failure: "ثبت ارسال انجام نشد. دوباره تلاش کنید.", onOk: () => window.location.reload() },
              );
            }}
          >
            <input className={fieldClass} aria-label="شرکت حمل" placeholder="شرکت حمل" value={carrier} onChange={(event) => setCarrier(event.target.value)} required maxLength={40} />
            <input className={fieldClass} aria-label="کد رهگیری" placeholder="کد رهگیری" dir="ltr" value={tracking} onChange={(event) => setTracking(event.target.value)} />
            <input className={fieldClass} aria-label="دلیل ثبت یا اصلاح ارسال" placeholder="دلیل ثبت یا اصلاح ارسال" value={note} onChange={(event) => setNote(event.target.value)} required minLength={2} maxLength={300} />
            <button className={buttonPrimary} type="submit" disabled={pending || note.trim().length < 2}>
              ثبت ارسال دستی
            </button>
          </form>
        </div>
      ) : null}
      {message ? (
        <p className="text-sm font-bold text-forest" role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
