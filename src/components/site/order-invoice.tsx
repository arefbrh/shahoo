import type { OrderView } from "@/lib/commerce-types";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { downloadInvoicePng, downloadInvoiceXlsx } from "@/lib/invoice-export";

export function OrderInvoice({ order }: { order: OrderView }) {
  return (
    <section className="invoice-print-root mt-6" aria-label="فاکتور فروش شاهو">
      <div className="invoice-toolbar mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-forest">فاکتور فروش</h2>
          <p className="mt-1 text-xs text-muted">نسخه قابل چاپ · اطلاعات بر اساس سفارش ثبت‌شده</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-full border border-line px-4 py-2.5 text-sm font-bold text-forest" onClick={() => downloadInvoicePng(order)}>خروجی PNG</button>
          <button type="button" className="rounded-full border border-line px-4 py-2.5 text-sm font-bold text-forest" onClick={() => downloadInvoiceXlsx(order)}>خروجی Excel (XLSX)</button>
          <button type="button" className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-ivory hover:bg-deep" onClick={() => { document.body.dataset.printTarget = "invoice"; window.addEventListener("afterprint", () => { delete document.body.dataset.printTarget; }, { once: true }); window.print(); }}>
            چاپ فاکتور / ذخیره PDF
          </button>
        </div>
      </div>

      <article className="invoice-sheet" dir="rtl">
        <header className="invoice-heading">
          <div className="invoice-brand">
            <img
              src="/assets/brand/shahoo-logo-minimal.jpg"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith(".png")) {
                  target.src = "/assets/brand/shahoo-logo-minimal.png";
                }
              }}
              alt="لوگوی مینیمال SHAHOO"
            />
          </div>
          <div className="invoice-title">
            <h1>فاکتور فروش</h1>
            <p>فروشگاه اینترنتی شاهو</p>
          </div>
        </header>

        <div className="invoice-meta">
          <p><strong>شماره فاکتور:</strong> <bdi dir="ltr">{order.publicCode}</bdi></p>
          <p><strong>تاریخ صدور:</strong> {order.createdAtLabel}</p>
        </div>

        <div className="invoice-parties">
          <section className="invoice-panel">
            <h2>اطلاعات فروشگاه</h2>
            <p><strong>نام فروشگاه:</strong> شاهو (SHAHOO)</p>
            <p className="invoice-muted">اطلاعات تماس و نشانی فروشنده از تنظیمات رسمی فروشگاه تکمیل خواهد شد.</p>
          </section>
          <section className="invoice-panel">
            <h2>اطلاعات خریدار</h2>
            <p><strong>نام خریدار:</strong> {order.fullName}</p>
            <p><strong>تلفن:</strong> <bdi dir="ltr">{order.mobile}</bdi></p>
            <p><strong>نشانی:</strong> {order.province}، {order.city}، {order.addressLine}{order.plaque ? `، پلاک ${order.plaque}` : ""}{order.unit ? `، واحد ${order.unit}` : ""}</p>
            <p><strong>کد پستی:</strong> <bdi dir="ltr">{order.postalCode || "—"}</bdi></p>
          </section>
        </div>

        <table className="invoice-lines">
          <thead>
            <tr><th colSpan={6} className="invoice-repeat-code">فاکتور {order.publicCode}</th></tr>
            <tr>
              <th>ردیف</th><th>شرح کالا</th><th>شناسه / تنوع</th><th>تعداد</th><th>مبلغ واحد</th><th>مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, index) => (
              <tr key={line.id}>
                <td>{toPersianNum(index + 1)}</td>
                <td>{line.name}</td>
                <td><bdi dir="ltr">{line.sku || "—"}</bdi>{line.label ? <span className="invoice-variant"> · {line.label}</span> : null}</td>
                <td>{toPersianNum(line.quantity)}</td>
                <td>{formatTomanFromIrr(line.unitPriceIrr)}</td>
                <td>{formatTomanFromIrr(line.lineTotalIrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-bottom">
          <section className="invoice-panel invoice-notes">
            <h2>توضیحات</h2>
            <p>از خرید شما سپاسگزاریم.</p>
            {order.customerNote ? <p>{order.customerNote}</p> : <p className="invoice-muted">برای پیگیری سفارش، شماره فاکتور را نزد خود نگه دارید.</p>}
          </section>
          <section className="invoice-totals" aria-label="خلاصه مبالغ">
            <p><span>جمع کالاها</span><strong>{formatTomanFromIrr(order.subtotalIrr)}</strong></p>
            <p><span>تخفیف</span><strong>{formatTomanFromIrr(order.discountIrr)}</strong></p>
            <p><span>هزینه ارسال</span><strong>{formatTomanFromIrr(order.shippingIrr)}</strong></p>
            <p className="invoice-grand-total"><span>مبلغ قابل پرداخت</span><strong>{formatTomanFromIrr(order.totalIrr)}</strong></p>
          </section>
        </div>

        <footer className="invoice-footer">
          <span>از خرید شما سپاسگزاریم</span>
          <small>SHAHOO</small>
        </footer>
      </article>
    </section>
  );
}
