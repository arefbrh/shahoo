import { useState } from "react";
import type { OrderView } from "@/lib/commerce-types";
import { toPersianNum } from "@/lib/format";

export function OrderPackingSlip({ order }: { order: OrderView }) {
  const [checked, setChecked] = useState<string[]>([]);
  function printSlip() {
    document.body.dataset.printTarget = "packing-slip";
    window.addEventListener("afterprint", () => { delete document.body.dataset.printTarget; }, { once: true });
    window.print();
  }
  return (
    <section className="packing-slip-print-root mt-5" dir="rtl" aria-label="برگه داخلی جمع‌آوری سفارش">
      <div className="packing-slip-toolbar mb-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-forest">برگه جمع‌آوری و بسته‌بندی</h2><p className="text-xs text-muted">ویژه انبار و اپراتور · برای مشتری ارسال نشود</p></div>
        <button type="button" className="rounded-full border border-gold px-5 py-2.5 text-sm font-bold text-forest" onClick={printSlip}>چاپ برگه انبار</button>
      </div>
      <article className="packing-slip-sheet">
        <header className="flex items-start justify-between gap-4 border-b-2 border-forest pb-4">
          <div><p className="text-xs font-bold tracking-widest text-gold">SHAHOO · OPERATIONS</p><h1 className="mt-2 text-2xl font-black text-forest">برگه جمع‌آوری سفارش</h1></div>
          <div className="text-left text-sm"><p>شماره سفارش</p><strong dir="ltr">{order.publicCode}</strong><p className="mt-2">تاریخ ثبت: {order.createdAtLabel}</p></div>
        </header>
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><h2 className="font-bold text-forest">گیرنده</h2><p className="mt-1">{order.fullName}</p><p dir="ltr">{order.mobile}</p><p>{order.province}، {order.city}، {order.addressLine}{order.plaque ? `، پلاک ${order.plaque}` : ""}{order.unit ? `، واحد ${order.unit}` : ""}</p><p>کد پستی: <bdi dir="ltr">{order.postalCode || "—"}</bdi></p></div>
          <div><h2 className="font-bold text-forest">کنترل بسته</h2><p className="mt-1">روش ارسال: {order.shippingTitle}</p><p>تعداد ردیف کالا: {toPersianNum(order.lines.length)}</p><p>تعداد کل واحدها: {toPersianNum(order.lines.reduce((sum, line) => sum + line.quantity, 0))}</p><p>یادداشت مشتری: {order.customerNote || "ندارد"}</p></div>
        </section>
        <table className="packing-slip-lines mt-5 w-full border-collapse text-sm">
          <thead><tr><th>برداشت</th><th>ردیف</th><th>کالا / تنوع</th><th>SKU</th><th>تعداد درخواستی</th><th>تعداد برداشته‌شده</th></tr></thead>
          <tbody>{order.lines.map((line, index) => <tr key={line.id}>
            <td><input aria-label={`برداشت ${line.name}`} type="checkbox" checked={checked.includes(line.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, line.id] : current.filter((id) => id !== line.id))} /></td>
            <td>{toPersianNum(index + 1)}</td><td>{line.name}{line.label ? <small className="block text-muted">{line.label}</small> : null}</td><td><bdi dir="ltr">{line.sku || "—"}</bdi></td><td>{toPersianNum(line.quantity)}</td><td>________</td>
          </tr>)}</tbody>
        </table>
        <footer className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-4 text-sm"><p>جمع‌آوری توسط: __________________</p><p>کنترل نهایی: __________________</p><p>تعداد بسته: __________________</p><p>وزن بسته: __________________</p><p className="col-span-2">مغایرت / توضیحات بسته‌بندی: __________________________________________________</p></footer>
      </article>
    </section>
  );
}
