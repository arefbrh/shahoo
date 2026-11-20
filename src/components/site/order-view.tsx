import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { OrderView } from "@/lib/commerce-types";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { cancelUnpaidOrderFn } from "@/server/offers/api";
import { retryPayPingSettlementForAdminFn, retryPayPingVerificationForAdminFn } from "@/server/payments/api";
import { buttonGhost, buttonPrimary, pageKicker, pageTitle, panelClass } from "./ui";
import { OrderActions } from "./order-actions";
import { OrderInvoice } from "./order-invoice";

export function OrderDetail({ order }: { order: OrderView | null }) {
  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold text-forest">پیگیری سفارش</h1>
        <p className="mt-4 text-sm leading-8">
          این سفارش برای شما در دسترس نیست. اگر همین‌جا ثبت شده، با همان مرورگر برگردید یا با حساب همان شماره وارد شوید.
        </p>
        <Link to="/account" className={`mt-6 ${buttonGhost}`}>
          حساب کاربری
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={`${pageTitle} text-left`} dir="ltr">
        {order.publicCode}
      </h1>
      <OrderInvoice order={order} />
      <OrderTrack isPaid={order.isPaid} isClosed={order.isClosed} label={order.statusLabel} paymentLabel={order.paymentStatusLabel} />
      <OrderActions order={order} />
      {order.canManagePayments && order.paymentRecovery?.length ? <PaymentRecovery attempts={order.paymentRecovery} /> : null}
      <p className="mt-4 rounded-3xl border border-gold/40 bg-cream p-4 text-sm leading-8">{order.paymentNote}</p>
      {order.holdUntilLabel ? (
        <p className="mt-3 text-sm leading-7 text-muted">موجودی تا {order.holdUntilLabel} کنار گذاشته شده است.</p>
      ) : null}
      {order.canCancel ? <CancelHold publicCode={order.publicCode} /> : null}
      <section className={`${panelClass} mt-6 p-5`}>
        <h2 className="font-bold text-forest">اقلام</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {order.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.name}
                <span className="block text-xs text-muted">
                  {line.label} · {toPersianNum(line.quantity)}
                  <span dir="ltr"> · {line.sku}</span>
                </span>
                <span className="mt-1 block text-xs text-muted">قیمت واحد: {formatTomanFromIrr(line.unitPriceIrr)}</span>
              </span>
              <span className="tabular-nums">{formatTomanFromIrr(line.lineTotalIrr)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <Money label="کالا" value={order.subtotalIrr} />
          <Money label="تخفیف" value={order.discountIrr} />
          <Money label="ارسال" value={order.shippingIrr} />
          <Money label="قابل پرداخت" value={order.totalIrr} strong />
        </dl>
        {order.couponCode ? <p className="mt-3 text-xs text-muted">کد: {order.couponCode}</p> : null}
        {order.staffNote ? <p className="mt-2 text-xs leading-6 text-muted">{order.staffNote}</p> : null}
      </section>
      <section className={`${panelClass} mt-4 p-5 text-sm leading-8`}>
        <h2 className="font-bold text-forest">ارسال</h2>
        <p className="mt-2">{order.shippingTitle}</p>
        <p className="mt-2">
          {order.fullName} · <span dir="ltr">{order.mobile}</span>
        </p>
        <p>
          {order.province}، {order.city}، {order.addressLine}
          {order.plaque ? `، پلاک ${order.plaque}` : ""}
          {order.unit ? `، واحد ${order.unit}` : ""}
        </p>
        <p>کد پستی {toPersianNum(order.postalCode)}</p>
        {order.customerNote ? <p className="text-muted">توضیح: {order.customerNote}</p> : null}
        <p className="text-xs text-muted">ثبت: {order.createdAtLabel}</p>
      </section>
      <section className="mt-4">
        <h2 className="font-bold text-forest">رویدادها</h2>
        <ul className="mt-3 space-y-2">
          {order.events.map((event) => (
            <li key={event.id} className={`${panelClass} px-4 py-3 text-sm`}>
              <div className="flex justify-between gap-3">
                <span className="font-bold text-forest">{event.statusLabel}</span>
                <time className="text-xs text-muted">{event.createdAtLabel}</time>
              </div>
              <p className="mt-1 text-muted">{event.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}


function PaymentRecovery({ attempts }: { attempts: NonNullable<OrderView["paymentRecovery"]> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function run(id: string, action: "verify" | "settle") {
    setBusy(`${id}:${action}`);
    setMessage("");
    try {
      if (action === "verify") await retryPayPingVerificationForAdminFn({ data: { attemptId: id } });
      else await retryPayPingSettlementForAdminFn({ data: { attemptId: id } });
      setMessage("درخواست بازیابی اجرا شد. وضعیت سفارش را دوباره بررسی کنید.");
      window.location.reload();
    } catch {
      setMessage("بازیابی انجام نشد؛ وضعیت پرداخت را در پنل درگاه و لاگ سرور بررسی کنید.");
    } finally {
      setBusy(null);
    }
  }
  return <section className={`${panelClass} mt-4 p-5`}>
    <h2 className="font-bold text-forest">بازیابی پرداخت (مدیریت)</h2>
    <p className="mt-2 text-xs leading-6 text-muted">این عملیات فقط تلاش مجدد با همان شناسه پرداخت را انجام می‌دهد؛ پرداخت تازه‌ای ایجاد نمی‌کند. قبل از هر تصمیم، وضعیت را در پنل PayPing تطبیق دهید.</p>
    {message ? <p className="mt-2 text-sm" role="status">{message}</p> : null}
    <ul className="mt-3 space-y-3">
      {attempts.map((attempt) => <li key={attempt.id} className="border-t border-line pt-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong dir="ltr">{attempt.provider} · {attempt.state}</strong><span>{formatTomanFromIrr(attempt.amountIrr)}</span></div>
        {attempt.settlementError ? <p className="mt-1 text-xs text-muted">{attempt.settlementError}</p> : null}
        {attempt.provider === "payping" && ["provider_outcome_unknown", "manual_review"].includes(attempt.state) && !attempt.verificationReady ? <p className="mt-1 text-xs text-muted">شناسه تأیید اولیه ثبت نشده است؛ ابتدا وضعیت این پرداخت را در پنل PayPing و با پشتیبانی درگاه تطبیق دهید.</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {attempt.provider === "payping" && attempt.verificationReady && ["provider_outcome_unknown", "manual_review"].includes(attempt.state) ? <button className={buttonGhost} type="button" disabled={busy !== null} onClick={() => void run(attempt.id, "verify")}>{busy === `${attempt.id}:verify` ? "در حال بررسی" : "تلاش مجدد تأیید درگاه"}</button> : null}
          {attempt.provider === "payping" && attempt.settlementReady && ["provider_verified", "local_settlement_pending"].includes(attempt.state) ? <button className={buttonPrimary} type="button" disabled={busy !== null} onClick={() => void run(attempt.id, "settle")}>{busy === `${attempt.id}:settle` ? "در حال تسویه" : "تلاش مجدد تسویه سفارش"}</button> : null}
        </div>
      </li>)}
    </ul>
  </section>;
}

function OrderTrack({ isPaid, isClosed, label, paymentLabel }: { isPaid: boolean; isClosed: boolean; label: string; paymentLabel: string }) {
  if (!isPaid) {
    const closed = isClosed;
    const steps = [
      { key: "registered", title: "ثبت سفارش", on: true },
      { key: "hold", title: "رزرو موجودی", on: true },
      { key: "pay", title: closed ? label : "پرداخت تأیید نشده", on: closed },
    ];
    return (
      <div>
        <ol className="mt-6 grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.key} className={`rounded-2xl border px-3 py-3 text-sm ${step.on ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-muted"}`}>
              <span className={`font-display text-xs ${step.on ? "text-gold-soft" : "text-gold"}`}>{toPersianNum(index + 1)}</span>
              <p className="mt-1 font-bold">{step.title}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-6 text-muted">تا وقتی پرداخت تأیید نشود، آماده ارسال و تحویل نشان داده نمی‌شود.</p>
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-forest bg-forest px-4 py-3 text-sm text-ivory">
        <span className="block text-xs text-gold-soft">وضعیت سفارش</span><strong className="mt-1 block">{label}</strong>
      </div>
      <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-forest">
        <span className="block text-xs text-muted">وضعیت پرداخت</span><strong className="mt-1 block">{paymentLabel}</strong>
      </div>
      <p className="text-xs leading-6 text-muted sm:col-span-2">وضعیت‌ها از آخرین اطلاعات ثبت‌شده در سفارش گرفته شده‌اند؛ هیچ وضعیت پرداخت یا تحویلی از این صفحه تغییر نمی‌کند.</p>
    </div>
  );
}

function CancelHold({ publicCode }: { publicCode: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-4">
      <p className="text-sm leading-7 text-muted">لغو، موجودی رزرو را برمی‌گرداند. پرداختی ثبت نمی‌شود و وضعیت پرداخت‌شده ساخته نمی‌شود.</p>
      {error ? <p className="mt-2 text-sm font-bold text-forest">{error}</p> : null}
      <button
        type="button"
        className={`mt-2 ${armed ? buttonPrimary : buttonGhost}`}
        disabled={pending}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setPending(true);
          void cancelUnpaidOrderFn({ data: { publicCode } })
            .then((result) => {
              if (!result.ok) {
                setError(result.message);
                setPending(false);
                setArmed(false);
                return;
              }
              window.location.reload();
            })
            .catch(() => {
              setError("لغو انجام نشد.");
              setPending(false);
            });
        }}
      >
        {pending ? "در حال لغو" : armed ? "تأیید لغو و آزاد شدن موجودی" : "لغو سفارش پرداخت‌نشده"}
      </button>
    </div>
  );
}

function Money({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold text-forest" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatTomanFromIrr(value)}</dd>
    </div>
  );
}
