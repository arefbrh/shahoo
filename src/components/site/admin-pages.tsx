import { useState, type FormEvent } from "react";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import type {
  AdminOrderList,
  CustomerDetail,
  CustomerList,
  DashboardData,
  DeskDenied,
  InventoryDesk,
  ReportsData,
  StaffDesk,
} from "@/lib/admin-types";
import { adjustInventoryFn } from "@/server/catalog/api";
import { setAdminAccessFn, setCustomerStatusFn } from "@/server/admin/api";
import { OrderDetail } from "./order-view";
import { OrderPackingSlip } from "./order-packing-slip";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";
import { AdminHelp } from "./admin-help";
import type { OrderView } from "@/lib/commerce-types";

function isDenied(value: { denied: boolean }): value is DeskDenied {
  return value.denied;
}

export function DashboardView({ data }: { data: DashboardData | DeskDenied | null }) {
  if (!data) return null;
  if (isDenied(data)) return <Note text={data.message} />;
  return (
    <div>
      <p className="text-xs font-bold text-gold">شاهو</p>
      <h1 className="mt-2 text-3xl font-bold text-forest">نمای کلی</h1>
      <AdminHelp title="نمای کلی">خلاصه عملکرد فروشگاه در بازه انتخابی را می‌بینید. برای بررسی یک سفارش مشخص وارد «سفارش‌ها» شوید؛ برای جزئیات روندها از «گزارش‌ها» استفاده کنید. اعداد این صفحه جایگزین تسویه بانکی نیستند.</AdminHelp>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["today", "امروز"],
          ["7", "۷ روز"],
          ["30", "۳۰ روز"],
          ["all", "همه"],
        ].map(([key, label]) => (
          <a key={key} href={`/admin?range=${key}`} className={`${data.range === key ? buttonPrimary : buttonGhost} px-4`}>
            {label}
          </a>
        ))}
      </div>
      <p className="mt-4 rounded-3xl bg-cream p-4 text-sm leading-8">{data.revenueNote}</p>
      {data.cards.length === 0 ? <p className="mt-6 text-sm">برای نقش شما عددی در این صفحه نیست.</p> : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.cards.map((card) => (
          <li key={card.label} className={`${panelClass} border-t-4 border-t-gold p-4`}>
            <p className="text-xs font-bold text-forest">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-forest">{toPersianNum(card.value)}</p>
            {card.hint ? <p className="mt-1 text-xs text-muted">{card.hint}</p> : null}
          </li>
        ))}
      </ul>
      {data.diagnostics.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-bold text-forest">هشدار موجودی</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.diagnostics.map((row) => (
              <li key={row.id} className="rounded-2xl bg-cream px-4 py-3">
                {row.message} <span className="text-muted">{row.createdAtLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.recentOrders.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-bold text-forest">آخرین سفارش‌ها</h2>
          <OrderTable rows={data.recentOrders.map((row) => ({ ...row, shippingTitle: "", couponCode: null, customerName: "—", customerMobile: "—" }))} />
        </section>
      ) : null}
      {data.audits.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-bold text-forest">رویدادهای اخیر</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.audits.map((row) => (
              <li key={row.id} className={`${panelClass} px-4 py-3`}>
                <span className="font-bold text-forest">{row.label}</span>
                <span className="text-muted"> · {row.actorLabel}</span>
                {row.detail ? <span className="text-muted"> · {row.detail}</span> : null}
                <span className="mt-1 block text-xs text-muted">{row.createdAtLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function OrdersView({ data }: { data: AdminOrderList | DeskDenied | null }) {
  if (!data) return null;
  if (isDenied(data)) return <Note text={data.message} />;
  return <div>
    <h1 className="text-3xl font-bold text-forest">سفارش‌ها</h1>
    <AdminHelp title="سفارش‌ها" example="برای پیدا کردن سفارش، کد سفارش را بدون فاصله در جست‌وجو وارد کنید و سپس وضعیت پرداخت یا تاریخ را محدود کنید.">این فهرست برای پیگیری چرخه سفارش است؛ فیلتر وضعیت سفارش با فیلتر وضعیت پرداخت فرق دارد. برای دیدن اقلام، نشانی، رویدادها و اقدامات مجاز روی کد سفارش بزنید. تأیید پرداخت از این صفحه انجام نمی‌شود و ثبت استرداد داخلی به معنی برگشت وجه در بانک نیست.</AdminHelp>
    <p className="mt-2 text-sm leading-7 text-muted">پرداخت از این صفحه تأیید نمی‌شود. استردادها فقط در دفتر داخلی ثبت می‌شوند و به معنی بازگشت وجه بانکی نیستند.</p>
    <form method="get" action="/admin/orders" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input name="q" defaultValue={data.q} placeholder={data.canSearchMobile ? "شماره سفارش، نام یا موبایل" : "شماره سفارش"} className={fieldClass} aria-label="جستجوی سفارش" />
      <select name="status" defaultValue={data.status} className={fieldClass} aria-label="وضعیت سفارش"><option value="">همه وضعیت‌ها</option>
        {[["awaiting_payment","در انتظار پرداخت"],["paid","پرداخت تأیید شده"],["processing","در حال آماده‌سازی"],["ready_to_ship","آماده ارسال"],["shipped","تحویل شرکت حمل"],["delivered","تحویل شده"],["cancelled","لغو شده"],["returned","مرجوع شده"],["refunded","بازپرداخت ثبت شد"],["partially_refunded","بازپرداخت جزئی ثبت شد"],["expired","مهلت موجودی تمام شد"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select name="paymentStatus" defaultValue={data.paymentStatus} className={fieldClass} aria-label="وضعیت پرداخت"><option value="">همه وضعیت‌های پرداخت</option>
        {[["unpaid","پرداخت نشده"],["pending","در انتظار پرداخت (قدیمی)"],["verified","پرداخت تأیید شده"],["failed","پرداخت ناموفق"],["expired","مهلت پرداخت تمام شد"],["refund_recorded","استرداد کامل در دفتر"],["partial_refund_recorded","استرداد جزئی در دفتر"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="text-xs text-muted">از تاریخ<input name="from" type="date" defaultValue={data.from} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-muted">تا تاریخ<input name="to" type="date" defaultValue={data.to} className={`${fieldClass} mt-1`} /></label>
      <button className={buttonPrimary} type="submit">اعمال فیلتر</button>
    </form>
    {data.error ? <p className="mt-3 text-sm font-bold text-forest" role="alert">{data.error}</p> : null}
    <p className="mt-4 text-xs text-muted">{toPersianNum(data.total)} سفارش</p>
    {data.rows.length ? <OrderTable rows={data.rows} /> : <p className="mt-4 text-sm">سفارشی با این فیلتر نیست.</p>}
    <Pager page={data.page} pages={data.pages} href={(page) => `/admin/orders?q=${encodeURIComponent(data.q)}&status=${data.status}&paymentStatus=${data.paymentStatus}&from=${data.from}&to=${data.to}&page=${page}`} />
  </div>;
}

export function AdminOrderPage({ order }: { order: OrderView | null }) {
  return (
    <div>
      <a href="/admin/orders" className="text-sm font-bold text-gold">
        بازگشت به فهرست
      </a>
      {order ? <OrderPackingSlip order={order} /> : null}
      <OrderDetail order={order} />
    </div>
  );
}

export function CustomersView({ data }: { data: CustomerList | DeskDenied | null }) {
  if (!data) return null;
  if (isDenied(data)) return <Note text={data.message} />;
  return <div>
    <h1 className="text-3xl font-bold text-forest">مشتریان</h1>
    <AdminHelp title="مشتریان" example="برای یافتن فرد، بخشی از نام یا شماره موبایل را جست‌وجو کنید؛ روی ردیف او بزنید تا نشانی‌ها و سفارش‌های اخیر را ببینید.">این بخش پرونده مشتریان ثبت‌نام‌کرده را نشان می‌دهد. فیلتر تاریخ مربوط به زمان عضویت است، نه تاریخ سفارش. مبلغ کنار هر مشتری جمع سفارش‌های ثبت‌شده است و نباید آن را درآمد قطعی تلقی کرد. مسدودسازی ورود فقط با ثبت دلیل انجام می‌شود.</AdminHelp>
    <form method="get" action="/admin/customers" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input name="q" defaultValue={data.q} placeholder="نام یا موبایل" className={fieldClass} />
      <select name="status" defaultValue={data.status} className={fieldClass} aria-label="وضعیت حساب"><option value="">همه وضعیت‌ها</option><option value="active">فعال</option><option value="blocked">مسدود</option></select>
      <label className="text-xs text-muted">ثبت‌نام از<input type="date" name="from" defaultValue={data.from} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-muted">ثبت‌نام تا<input type="date" name="to" defaultValue={data.to} className={`${fieldClass} mt-1`} /></label>
      <button className={buttonPrimary} type="submit">جستجو / فیلتر</button>
    </form>
    {data.error ? <p className="mt-3 text-sm font-bold text-forest" role="alert">{data.error}</p> : null}
    <p className="mt-3 text-xs text-muted">{toPersianNum(data.total)} مشتری · حداکثر ۲۰ مورد در هر صفحه</p>
    {data.rows.length === 0 ? <p className="mt-6 text-sm">مشتری‌ای پیدا نشد.</p> : <ul className="mt-4 space-y-2">{data.rows.map((row) => <li key={row.id}>
      <a href={`/admin/customers/${row.id}`} className={`${panelClass} grid min-h-11 gap-2 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4`}>
        <span><strong className="text-forest">{row.fullName}</strong><span className="mt-1 block text-xs text-muted" dir="ltr">{row.mobileMasked}</span></span>
        <span>{row.statusLabel} · {toPersianNum(row.orderCount)} سفارش</span>
        <span>{formatTomanFromIrr(row.totalIrr)} جمع سفارش‌های ثبت‌شده، نه درآمد</span>
        <span className="text-xs text-muted">عضویت {row.createdAtLabel}<br />آخرین سفارش {row.latestOrderAtLabel || "ندارد"}</span>
      </a>
    </li>)}</ul>}
    <Pager page={data.page} pages={data.pages} href={(page) => `/admin/customers?q=${encodeURIComponent(data.q)}&status=${data.status}&from=${data.from}&to=${data.to}&page=${page}`} />
  </div>;
}

export function CustomerView({ data }: { data: CustomerDetail | DeskDenied | null }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  if (!data) return <Note text="این مشتری پیدا نشد." />;
  if (isDenied(data)) return <Note text={data.message} />;
  const customerId = data.id;
  async function save(status: "active" | "blocked") {
    if (reason.trim().length < 2) { setMessage("دلیل را وارد کنید."); return; }
    if (!window.confirm(`${status === "blocked" ? "ورود مشتری مسدود شود؟" : "مسدودیت ورود مشتری برداشته شود؟"} دلیل: ${reason.trim()}`)) return;
    setPending(true); setMessage("");
    try {
      const result = await setCustomerStatusFn({ data: { id: customerId, status, reason } });
      setMessage(result.ok ? "وضعیت ذخیره شد." : result.message);
      if (result.ok) window.location.reload();
    } catch { setMessage("ذخیره انجام نشد."); } finally { setPending(false); }
  }
  return <div>
    <a href="/admin/customers" className="text-sm font-bold text-gold">بازگشت به فهرست</a>
    <h1 className="mt-3 text-3xl font-bold text-forest">{data.fullName}</h1>
    <p className="mt-2 text-sm" dir="ltr">{data.mobile}</p>
    <p className="mt-2 text-sm text-muted">{data.statusLabel} · عضویت {data.createdAtLabel} · {toPersianNum(data.orderCount)} سفارش · {formatTomanFromIrr(data.totalIrr)} جمع سفارش‌های ثبت‌شده، نه درآمد</p>
    {data.email ? <p className="mt-1 text-sm text-muted">{data.email}</p> : null}
    <section className={`${panelClass} mt-4 space-y-2 p-4 text-sm`} aria-label="اطلاعات پروفایل"><h2 className="font-bold text-forest">اطلاعات پروفایل</h2><p>نام: {data.firstName || "ثبت نشده"} · نام خانوادگی: {data.lastName || "ثبت نشده"}</p><p>جنسیت: {profileValue(data.gender)} · گروه سنی: {profileValue(data.ageGroup)}</p></section>
    {data.canWrite ? <div className={`${panelClass} mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto]`}><label className="text-sm font-bold text-forest">دلیل تغییر وضعیت<input value={reason} onChange={(event) => setReason(event.target.value)} className={`${fieldClass} mt-2`} required minLength={2} maxLength={400} /></label><button type="button" className={buttonGhost} disabled={pending} onClick={() => void save(data.status === "blocked" ? "active" : "blocked")}>{data.status === "blocked" ? "رفع مسدودیت ورود" : "مسدود کردن ورود"}</button></div> : null}
    {message ? <p className="mt-3 text-sm font-bold text-forest" role="status">{message}</p> : null}
    <section className="mt-6"><h2 className="font-bold text-forest">نشانی‌های ذخیره‌شده</h2>{data.addresses.length === 0 ? <p className="mt-2 text-sm text-muted">نشانی ذخیره‌شده‌ای نیست.</p> : null}<ul className="mt-3 space-y-2">{data.addresses.map((address) => <li key={address.id} className={`${panelClass} p-4 text-sm leading-7`}><strong>{address.label || "نشانی"}{address.isDefault ? " · پیش‌فرض" : ""}</strong><p>{address.recipientName || data.fullName} · <span dir="ltr">{address.recipientMobile || data.mobile}</span></p><p>{address.province}، {address.city}، {address.addressLine}{address.plaque ? `، پلاک ${address.plaque}` : ""}{address.unit ? `، واحد ${address.unit}` : ""}</p>{address.postalCode ? <p>کد پستی {toPersianNum(address.postalCode)}</p> : null}</li>)}</ul></section>
    <section className="mt-6"><h2 className="font-bold text-forest">سابقه سفارش ({toPersianNum(data.orders.length)} مورد اخیر از {toPersianNum(data.orderCount)})</h2>{data.orders.length === 0 ? <p className="mt-2 text-sm text-muted">سفارشی ثبت نشده است.</p> : <ul className="mt-3 space-y-2">{data.orders.map((order) => <li key={order.publicCode}><a href={`/admin/orders/${order.publicCode}`} className={`${panelClass} block px-4 py-3 text-sm`}><span dir="ltr">{order.publicCode}</span> · {order.statusLabel} · {formatTomanFromIrr(order.totalIrr)} · {order.createdAtLabel}</a></li>)}</ul>}</section>
  </div>;
}

export function InventoryView({ data }: { data: InventoryDesk | DeskDenied | null }) {
  const [variantId, setVariantId] = useState(""); const [delta, setDelta] = useState("0"); const [note, setNote] = useState(""); const [confirm, setConfirm] = useState(false); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  if (!data) return null; if (isDenied(data)) return <Note text={data.message} />;
  async function save(event: FormEvent) {
    event.preventDefault(); if (!confirm) { setMessage("تغییر موجودی را تأیید کنید."); return; }
    if (!window.confirm("این اصلاح موجودی ثبت دائمی خواهد شد. ادامه می‌دهید؟")) return;
    setPending(true); setMessage("");
    try { const result = await adjustInventoryFn({ data: { variantId, delta: Number(delta), note } }); setMessage(result.ok ? "موجودی اصلاح شد." : result.message); if (result.ok) window.location.reload(); }
    catch { setMessage("اصلاح موجودی انجام نشد."); } finally { setPending(false); }
  }
  return <div>
    <h1 className="text-3xl font-bold text-forest">موجودی</h1><AdminHelp title="موجودی" example="اگر ۱۲ عدد فیزیکی دارید و ۲ عدد برای سفارش‌ها رزرو شده، موجودی قابل فروش ۱۰ است. برای اصلاح فیزیکی، تغییر +۳ یا -۲ و دلیل دقیق ثبت کنید.">موجودی بر اساس بسته هر محصول مدیریت می‌شود. «فیزیکی» تعداد ثبت‌شده در انبار، «رزرو» تعداد کنارگذاشته‌شده برای سفارش و «قابل فروش» اختلاف این دو است. فیلتر کم‌موجود از آستانه همان بسته استفاده می‌کند. اصلاح دستی دائمی و قابل ردگیری است؛ فقط برای شمارش یا اصلاح واقعی انبار از آن استفاده کنید.</AdminHelp><p className="mt-2 text-sm text-muted">قابل فروش = موجودی فیزیکی − رزرو. رزرو پرداخت‌نشده برداشت فیزیکی نیست؛ رزرو با تأیید پرداخت به برداشت موجودی تبدیل می‌شود.</p>
    {data.diagnostics.length ? <ul className="mt-4 space-y-2 text-sm">{data.diagnostics.map((row) => <li key={row.id} className="rounded-2xl bg-cream px-4 py-3" role="alert">{row.message}</li>)}</ul> : null}
    <form method="get" action="/admin/inventory" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input name="q" defaultValue={data.q} placeholder="نام محصول، بسته یا SKU" className={fieldClass} /><select name="categoryId" defaultValue={data.categoryId} className={fieldClass} aria-label="دسته‌بندی"><option value="">همه دسته‌ها</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="stock" defaultValue={data.stock} className={fieldClass} aria-label="وضعیت موجودی"><option value="">همه موجودی‌ها</option><option value="low">کم‌موجود طبق آستانه ذخیره‌شده</option><option value="out">ناموجود (قابل فروش صفر)</option></select><button className={buttonPrimary} type="submit">اعمال فیلتر</button></form>
    <p className="mt-3 text-xs text-muted">{toPersianNum(data.total)} بسته · ۲۰ مورد در هر صفحه</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="text-xs text-gold"><tr><th className="p-2 text-start">محصول</th><th className="p-2 text-start">بسته / واحد</th><th className="p-2 text-start">SKU</th><th className="p-2 text-start">فیزیکی</th><th className="p-2 text-start">رزرو</th><th className="p-2 text-start">قابل فروش</th><th className="p-2 text-start">آستانه</th><th className="p-2 text-start">وضعیت</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.variantId} className={row.low ? "bg-cream" : ""}><td className="p-2">{row.productName}<span className="block text-xs text-muted">{row.categoryName}</span></td><td className="p-2">{row.unitLabel}</td><td className="p-2" dir="ltr">{row.sku}</td><td className="p-2">{toPersianNum(row.onHand)}</td><td className="p-2">{toPersianNum(row.reserved)}</td><td className="p-2">{toPersianNum(row.sellable)}</td><td className="p-2">{toPersianNum(row.threshold)}</td><td className="p-2">{row.sellable <= 0 ? "ناموجود" : row.low ? "کم‌موجود" : "موجود"}</td></tr>)}</tbody></table></div>
    {data.rows.length === 0 ? <p className="mt-3 text-sm text-muted">بسته‌ای با این فیلتر پیدا نشد.</p> : null}<Pager page={data.page} pages={data.pages} href={(page) => inventoryHref(data, { page })} />
    {data.canWrite ? <form onSubmit={save} className={`${panelClass} mt-6 grid gap-3 p-4 md:grid-cols-2`}><label className="text-sm font-bold text-forest">بسته<select value={variantId} onChange={(event) => setVariantId(event.target.value)} className={`${fieldClass} mt-2`} required><option value="">انتخاب کنید</option>{data.rows.map((row) => <option key={row.variantId} value={row.variantId}>{row.productName} — {row.unitLabel} — {row.sku}</option>)}</select></label><label className="text-sm font-bold text-forest">تغییر عدد<input value={delta} onChange={(event) => setDelta(event.target.value)} dir="ltr" inputMode="numeric" className={`${fieldClass} mt-2 text-left`} required /></label><label className="text-sm font-bold text-forest md:col-span-2">دلیل<input value={note} onChange={(event) => setNote(event.target.value)} className={`${fieldClass} mt-2`} required minLength={2} maxLength={200} /></label><label className="flex min-h-11 items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />تغییر موجودی را تأیید می‌کنم</label><button className={buttonPrimary} disabled={pending} type="submit">ثبت اصلاح</button></form> : <p className="mt-4 text-sm text-muted">اصلاح موجودی برای نقش شما بسته است.</p>}
    {message ? <p className="mt-3 text-sm font-bold text-forest" role="status">{message}</p> : null}
    <h2 className="mt-8 font-bold text-forest">سابقه حرکت موجودی · {toPersianNum(data.logTotal)} مورد</h2><p className="mt-2 text-xs leading-6 text-muted">رزرو پرداخت‌نشده، تغییر رزروشده است و برداشت فیزیکی نیست. رکوردهای قدیمی فاقد snapshot هستند؛ عددهای قبل و بعد برای آن‌ها بازسازی نمی‌شوند. رابطه سفارش نمایش داده می‌شود اگر ثبت شده باشد.</p>
    {data.logs.length === 0 ? <p className="mt-3 text-sm text-muted">حرکتی با این فیلتر پیدا نشد.</p> : <ul className="mt-3 space-y-2 text-sm">{data.logs.map((log) => <li key={log.id} className={`${panelClass} px-4 py-3`}><strong>{log.productName} · {log.variantLabel}</strong> <span dir="ltr">({log.sku})</span><span className="mt-1 block">{movementLabel(log.reason)} · تغییر {toPersianNum(log.delta)}</span>{log.onHandBefore !== null && log.onHandAfter !== null ? <span className="block text-xs">فیزیکی: {toPersianNum(log.onHandBefore)} ← {toPersianNum(log.onHandAfter)} · رزرو: {log.reservedBefore === null ? "—" : toPersianNum(log.reservedBefore)} ← {log.reservedAfter === null ? "—" : toPersianNum(log.reservedAfter)}</span> : <span className="block text-xs text-muted">مانده‌های پیش/پس در سابقه قدیمی ذخیره نشده‌اند.</span>}<span className="mt-1 block text-xs text-muted">{log.note}{log.orderCode ? ` · سفارش ${log.orderCode}` : ""} · {log.actorLabel} · {log.createdAtLabel}</span></li>)}</ul>}
    <Pager page={data.logPage} pages={data.logPages} href={(logPage) => inventoryHref(data, { logPage })} />
  </div>;
}

export function ReportsView({ data }: { data: ReportsData | DeskDenied | null }) {
  if (!data) return null;
  if (isDenied(data)) return <Note text={data.message} />;
  const blocks = [
    ["موجودی", data.inventory],
    ["وضعیت سفارش", data.orderStatus],
    ["مشتریان", data.registrations],
    ["کد تخفیف", data.coupons],
    ["روش ارسال", data.shipping],
  ] as const;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">گزارش‌ها</h1>
      <AdminHelp title="گزارش‌ها">این صفحه خلاصه‌های عملیاتی موجود مانند وضعیت سفارش، ثبت‌نام مشتری، موجودی، کدهای تخفیف و روش‌های ارسال را نشان می‌دهد. برای رسیدگی به یک رکورد خاص از صفحه مربوط به خودش استفاده کنید. تعریف درآمد و محدودیت داده‌های پرداخت در یادداشت زیر آمده است.</AdminHelp>
      <p className="mt-3 rounded-3xl bg-cream p-4 text-sm leading-8">{data.revenueNote}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {blocks.map(([title, rows]) => (
          <section key={title} className={`${panelClass} p-4`}>
            <h2 className="font-bold text-forest">{title}</h2>
            {rows.length === 0 ? <p className="mt-3 text-sm text-muted">موردی نیست.</p> : null}
            <ul className="mt-3 space-y-2 text-sm">
              {rows.map((row) => (
                <li key={row.label} className="flex justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-bold text-forest">{toPersianNum(row.value)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="گزارش‌های تجمیعی اطلاعات اختیاری مشتریان">
        {([["جنسیت (تجمیعی)", data.demographics.gender], ["گروه سنی (تجمیعی)", data.demographics.ageGroup]] as const).map(([title, report]) => (
          <section key={title} className={`${panelClass} p-4`}>
            <h2 className="font-bold text-forest">{title}</h2>
            <p className="mt-2 text-xs leading-6 text-muted">درصد هر گروه فقط از میان پاسخ‌های ثبت‌شده محاسبه شده است؛ افراد بدون پاسخ جداگانه شمرده می‌شوند. این داده‌ها فقط به‌صورت تجمیعی نمایش داده می‌شوند.</p>
            <p className="mt-2 text-sm">پاسخ ثبت‌شده: <strong>{toPersianNum(report.answered)}</strong> · بدون پاسخ: <strong>{toPersianNum(report.missing)}</strong></p>
            {report.categories.length === 0 ? <p className="mt-3 text-sm text-muted">هنوز پاسخی ثبت نشده است.</p> : null}
            <ul className="mt-3 space-y-2 text-sm">
              {report.categories.map((row) => <li key={row.label} className="flex justify-between gap-3"><span>{row.label}</span><span className="font-bold text-forest">{toPersianNum(row.value)}</span></li>)}
            </ul>
          </section>
        ))}
      </section>
      <h2 className="mt-8 font-bold text-forest">کم‌موجود</h2>
      {data.lowStock.length === 0 ? <p className="mt-3 text-sm">بسته کم‌موجودی نیست.</p> : null}
      <ul className="mt-3 space-y-2 text-sm">
        {data.lowStock.map((row) => (
          <li key={row.variantId} className={`${panelClass} px-4 py-3`}>
            {row.productName} · {row.label} · قابل فروش {toPersianNum(row.sellable)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StaffView({ data }: { data: StaffDesk | DeskDenied | null }) {
  if (!data) return null;
  if (isDenied(data)) return <Note text={data.message} />;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">مدیران</h1>
      <AdminHelp title="مدیران" example="برای همکار پشتیبانی فقط نقش و دسترسی‌های لازم را نگه دارید؛ دسترسی سفارش یا تنظیمات را بدون نیاز فعال نکنید.">در این بخش حساب‌های مدیریتی و سطح دسترسی آن‌ها را بازبینی می‌کنید. تغییر نقش فوراً روی دسترسی‌های مدیریتی اثر می‌گذارد. رمز عبور در این صفحه نمایش داده نمی‌شود؛ آخرین مدیر ارشد فعال نیز برای جلوگیری از قفل‌شدن پنل قابل حذف یا غیرفعال‌سازی نیست.</AdminHelp>
      <p className="mt-2 text-sm leading-7 text-muted">رمز مدیر اینجا ساخته یا نشان داده نمی‌شود. آخرین مدیر ارشد فعال را نمی‌توان برداشت.</p>
      <ul className="mt-4 space-y-4">
        {data.admins.map((row) => (
          <StaffCard key={row.id} row={row} choices={data.roleChoices} canWrite={data.canWrite} />
        ))}
      </ul>
    </div>
  );
}

function StaffCard({
  row,
  choices,
  canWrite,
}: {
  row: StaffDesk["admins"][number];
  choices: StaffDesk["roleChoices"];
  canWrite: boolean;
}) {
  const [roles, setRoles] = useState(row.roles);
  const [status, setStatus] = useState(row.status === "disabled" ? "disabled" : "active");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function save() {
    if (!confirm) {
      setMessage("تغییر نقش را تأیید کنید.");
      return;
    }
    if (roles.length === 0) {
      setMessage("حداقل یک نقش لازم است.");
      return;
    }
    setPending(true);
    try {
      const result = await setAdminAccessFn({ data: { id: row.id, status, roles } });
      setMessage(result.ok ? "نقش ذخیره شد." : result.message);
      if (result.ok) window.location.reload();
    } catch {
      setMessage("ذخیره نقش انجام نشد.");
    } finally {
      setPending(false);
    }
  }
  return (
    <li className={`${panelClass} p-4 text-sm`}>
      <p className="font-bold text-forest">
        {row.fullName}
        {row.self ? " (شما)" : ""}
      </p>
      <p className="mt-1 text-xs text-muted" dir="ltr">
        {row.email ?? row.mobileMasked ?? ""}
      </p>
      <p className="mt-1 text-xs text-muted">{row.statusLabel}</p>
      {canWrite ? (
        <div className="mt-3 space-y-2">
          {choices.map((choice) => (
            <label key={choice.key} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={roles.includes(choice.key)}
                onChange={(event) =>
                  setRoles((current) => (event.target.checked ? [...current, choice.key] : current.filter((key) => key !== choice.key)))
                }
              />
              {choice.name}
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={status === "disabled"} onChange={(event) => setStatus(event.target.checked ? "disabled" : "active")} />
            غیرفعال
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
            این تغییر را تأیید می‌کنم
          </label>
          <button type="button" className={buttonPrimary} disabled={pending} onClick={() => void save()}>
            ذخیره نقش
          </button>
        </div>
      ) : (
        <p className="mt-2">{row.roles.join("، ") || "بدون نقش"}</p>
      )}
      {message ? <p className="mt-2 font-bold text-forest" role="status">{message}</p> : null}
    </li>
  );
}

function OrderTable({ rows }: { rows: AdminOrderList["rows"] }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="text-xs text-gold"><tr><th className="p-2 text-start">سفارش</th><th className="p-2 text-start">مشتری</th><th className="p-2 text-start">تاریخ</th><th className="p-2 text-start">مبلغ</th><th className="p-2 text-start">وضعیت سفارش</th><th className="p-2 text-start">پرداخت</th><th className="p-2 text-start">ارسال</th><th className="p-2 text-start">اقلام</th></tr></thead><tbody>{rows.map((row) => <tr key={row.publicCode} className="border-t border-line"><td className="p-2"><a className="font-bold text-forest" href={`/admin/orders/${row.publicCode}`} dir="ltr">{row.publicCode}</a></td><td className="p-2">{row.customerName || "مشتری"}<span className="block text-xs text-muted" dir="ltr">{row.customerMobile || row.mobileMasked || ""}</span></td><td className="p-2">{row.createdAtLabel}</td><td className="p-2">{formatTomanFromIrr(row.totalIrr)}</td><td className="p-2">{row.statusLabel}</td><td className="p-2">{row.paymentStatusLabel}</td><td className="p-2">{row.shippingTitle || "ثبت نشده"}</td><td className="p-2">{toPersianNum(row.itemCount)}</td></tr>)}</tbody></table></div>;
}

function Pager({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex gap-2">
      {page > 1 ? (
        <a className={buttonGhost} href={href(page - 1)}>
          قبلی
        </a>
      ) : null}
      <span className="inline-flex min-h-11 items-center px-2 text-sm">
        {toPersianNum(page)} از {toPersianNum(pages)}
      </span>
      {page < pages ? (
        <a className={buttonGhost} href={href(page + 1)}>
          بعدی
        </a>
      ) : null}
    </div>
  );
}

function profileValue(value: string | null): string {
  const labels: Record<string, string> = { female: "زن", male: "مرد", prefer_not_to_say: "ترجیح می‌دهم نگویم", under_18: "کمتر از ۱۸", "18_24": "۱۸–۲۴", "25_34": "۲۵–۳۴", "35_44": "۳۵–۴۴", "45_54": "۴۵–۵۴", "55_plus": "۵۵+" };
  return value ? labels[value] ?? "ثبت شده" : "ثبت نشده";
}
function movementLabel(reason: string): string {
  const labels: Record<string, string> = { opening_balance: "موجودی آغازین", adjustment: "اصلاح دستی", reserve_unpaid: "رزرو سفارش پرداخت‌نشده", capture_paid: "برداشت پس از تأیید داخلی پرداخت", capture_recovered: "برداشت پس از بازیابی سفارش", release_expired: "آزادسازی رزرو منقضی", release_cancelled: "آزادسازی رزرو لغوشده", restock_cancel: "بازگشت موجودی لغوشده" };
  return labels[reason] ?? "حرکت ثبت‌شده";
}
function inventoryHref(data: InventoryDesk, change: { page?: number; logPage?: number }): string {
  const params = new URLSearchParams({ q: data.q, categoryId: data.categoryId, stock: data.stock, page: String(change.page ?? data.page), logPage: String(change.logPage ?? data.logPage) });
  return `/admin/inventory?${params.toString()}`;
}

function Note({ text }: { text: string }) {
  return <p className="rounded-3xl bg-cream p-5 text-sm font-bold leading-8 text-forest" role="alert">{text}</p>;
}
