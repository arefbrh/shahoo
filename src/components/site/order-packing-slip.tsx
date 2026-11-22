import { useEffect, useState } from "react";
import type { OrderView } from "@/lib/commerce-types";
import { toPersianNum } from "@/lib/format";
import { getOrderPackingWorkFn, saveOrderPackingWorkFn } from "@/server/commerce/fulfillment-api";

type PackingWork = {
  pickedItems: Array<{ orderItemId: string; pickedQuantity: number }>;
  pickerName: string;
  checkerName: string;
  packageCount: number;
  weightGrams: number | null;
  discrepancyNote: string;
  updatedAt?: string;
};

export function OrderPackingSlip({ order }: { order: OrderView }) {
  const [work, setWork] = useState<PackingWork>({
    pickedItems: order.lines.map((line) => ({ orderItemId: line.id, pickedQuantity: 0 })),
    pickerName: "", checkerName: "", packageCount: 1, weightGrams: null, discrepancyNote: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getOrderPackingWorkFn({ data: { publicCode: order.publicCode } })
      .then((saved) => {
        if (!active || !saved) return;
        setWork({
          pickedItems: order.lines.map((line) => ({
            orderItemId: line.id,
            pickedQuantity: saved.pickedItems.find((item) => item.orderItemId === line.id)?.pickedQuantity ?? 0,
          })),
          pickerName: saved.pickerName,
          checkerName: saved.checkerName,
          packageCount: saved.packageCount,
          weightGrams: saved.weightGrams,
          discrepancyNote: saved.discrepancyNote,
          updatedAt: saved.updatedAt,
        });
      })
      .catch(() => { if (active) setMessage("اطلاعات قبلی بارگذاری نشد؛ دسترسی و اتصال را بررسی کنید."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [order.publicCode]);

  function updatePicked(id: string, quantity: number) {
    setWork((current) => ({
      ...current,
      pickedItems: current.pickedItems.map((item) => item.orderItemId === id ? { ...item, pickedQuantity: quantity } : item),
    }));
  }

  async function saveWork() {
    setSaving(true);
    setMessage("");
    try {
      const result = await saveOrderPackingWorkFn({
        data: {
          publicCode: order.publicCode,
          pickedItems: work.pickedItems,
          pickerName: work.pickerName,
          checkerName: work.checkerName,
          packageCount: work.packageCount,
          weightGrams: work.weightGrams,
          discrepancyNote: work.discrepancyNote,
        },
      });
      setMessage(result.message);
      if (result.ok) setWork((current) => ({ ...current, updatedAt: new Date().toISOString() }));
    } catch {
      setMessage("ذخیره انجام نشد؛ احتمالاً دسترسی ثبت عملیات بسته‌بندی برای نقش شما فعال نیست.");
    } finally {
      setSaving(false);
    }
  }

  function printSlip() {
    document.body.dataset.printTarget = "packing-slip";
    window.addEventListener("afterprint", () => { delete document.body.dataset.printTarget; }, { once: true });
    window.print();
  }

  return (
    <section className="packing-slip-print-root mt-5" dir="rtl" aria-label="برگه داخلی جمع‌آوری سفارش">
      <div className="packing-slip-toolbar mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-forest">برگه جمع‌آوری و بسته‌بندی</h2>
          <p className="text-xs text-muted">ویژه انبار و اپراتور · برای مشتری ارسال نشود</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading || saving} className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-ivory disabled:opacity-50" onClick={saveWork}>
            {saving ? "در حال ذخیره…" : "ذخیره اطلاعات بسته‌بندی"}
          </button>
          <button type="button" className="rounded-full border border-gold px-5 py-2.5 text-sm font-bold text-forest" onClick={printSlip}>چاپ برگه انبار</button>
        </div>
      </div>
      <article className="packing-slip-sheet">
        {message ? <p role="status" className="mb-3 text-sm font-bold text-forest">{message}</p> : null}
        {loading ? <p className="mb-3 text-sm text-muted">در حال دریافت اطلاعات بسته‌بندی…</p> : null}
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
          <tbody>{order.lines.map((line, index) => {
            const picked = work.pickedItems.find((item) => item.orderItemId === line.id)?.pickedQuantity ?? 0;
            return <tr key={line.id}>
              <td><input aria-label={`برداشت ${line.name}`} type="checkbox" checked={picked === line.quantity} onChange={(event) => updatePicked(line.id, event.target.checked ? line.quantity : 0)} /></td>
              <td>{toPersianNum(index + 1)}</td><td>{line.name}{line.label ? <small className="block text-muted">{line.label}</small> : null}</td>
              <td><bdi dir="ltr">{line.sku || "—"}</bdi></td><td>{toPersianNum(line.quantity)}</td>
              <td><input className="w-20 rounded border border-line px-2 py-1 text-center" type="number" min={0} max={line.quantity} value={picked} onChange={(event) => updatePicked(line.id, Math.max(0, Math.min(line.quantity, Number(event.target.value) || 0)))} aria-label={`تعداد برداشت‌شده ${line.name}`} /></td>
            </tr>;
          })}</tbody>
        </table>
        <footer className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
          <label>جمع‌آوری توسط<input className="mt-1 w-full rounded border border-line px-3 py-2" maxLength={80} value={work.pickerName} onChange={(event) => setWork((v) => ({ ...v, pickerName: event.target.value }))} /></label>
          <label>کنترل نهایی<input className="mt-1 w-full rounded border border-line px-3 py-2" maxLength={80} value={work.checkerName} onChange={(event) => setWork((v) => ({ ...v, checkerName: event.target.value }))} /></label>
          <label>تعداد بسته<input className="mt-1 w-full rounded border border-line px-3 py-2" type="number" min={1} max={100} value={work.packageCount} onChange={(event) => setWork((v) => ({ ...v, packageCount: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} /></label>
          <label>وزن کل بسته (گرم)<input className="mt-1 w-full rounded border border-line px-3 py-2" type="number" min={0} max={100000} value={work.weightGrams ?? ""} onChange={(event) => setWork((v) => ({ ...v, weightGrams: event.target.value === "" ? null : Math.max(0, Math.min(100000, Number(event.target.value) || 0)) }))} /></label>
          <label className="col-span-2">مغایرت / توضیحات بسته‌بندی<textarea className="mt-1 w-full rounded border border-line px-3 py-2" rows={3} maxLength={1000} value={work.discrepancyNote} onChange={(event) => setWork((v) => ({ ...v, discrepancyNote: event.target.value }))} /></label>
          {work.updatedAt ? <p className="col-span-2 text-xs text-muted">آخرین ذخیره: {new Date(work.updatedAt).toLocaleString("fa-IR")}</p> : null}
        </footer>
      </article>
    </section>
  );
}
