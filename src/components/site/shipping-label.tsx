import { useEffect, useState } from "react";
import { getOrderShippingLabelsFn } from "@/server/commerce/fulfillment-api";
import type { OrderView } from "@/lib/commerce-types";
import { toPersianNum } from "@/lib/format";

type Address = { name?: string; phone?: string; province?: string; city?: string; address?: string; postalCode?: string; plaque?: string; unit?: string } | null;
type Shipment = Awaited<ReturnType<typeof getOrderShippingLabelsFn>>[number];

export function ShippingLabelDesk({ order }: { order: OrderView }) {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [selected, setSelected] = useState("");
  const [size, setSize] = useState<"100x150" | "a4">("100x150");
  const [message, setMessage] = useState("در حال دریافت سابقه مرسوله‌ها…");
  useEffect(() => {
    let active = true;
    getOrderShippingLabelsFn({ data: { publicCode: order.publicCode } })
      .then((items) => { if (!active) return; setRows(items); setSelected(items[0]?.id ?? ""); setMessage(items.length ? "" : "هنوز مرسوله‌ای برای این سفارش ثبت نشده است."); })
      .catch(() => { if (active) setMessage("دریافت سابقه ارسال انجام نشد."); });
    return () => { active = false; };
  }, [order.publicCode]);
  const shipment = rows.find((row) => row.id === selected);
  const sender = shipment?.senderSnapshot as Address;
  const recipient = shipment?.recipientSnapshot as Address;
  function print() {
    if (!shipment || !sender || !recipient) return;
    document.body.dataset.printTarget = "shipping-label";
    document.body.dataset.labelSize = size;
    window.addEventListener("afterprint", () => { delete document.body.dataset.printTarget; delete document.body.dataset.labelSize; }, { once: true });
    window.print();
  }
  return <section className="shipping-label-desk mt-5 rounded-2xl border border-line bg-white p-4" dir="rtl">
    <div className="shipping-label-toolbar flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-bold text-forest">چاپ و بازچاپ نشانی مرسوله</h2><p className="mt-1 text-xs text-muted">نشانی‌ها از اطلاعات ثبت‌شده در زمان ایجاد همین مرسوله خوانده می‌شوند.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-muted">مرسوله<select className="mt-1 block rounded-lg border border-line p-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">انتخاب مرسوله</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.carrier} · {new Date(row.createdAt).toLocaleDateString("fa-IR")}</option>)}</select></label>
        <label className="text-xs text-muted">قالب چاپ<select className="mt-1 block rounded-lg border border-line p-2 text-sm" value={size} onChange={(e) => setSize(e.target.value as "100x150" | "a4")}><option value="100x150">۱۰ × ۱۵ سانتی‌متر</option><option value="a4">A4</option></select></label>
        <button type="button" disabled={!shipment || !sender || !recipient} onClick={print} className="self-end rounded-full bg-forest px-4 py-2 text-sm font-bold text-white disabled:opacity-40">چاپ / بازچاپ برچسب</button>
      </div>
    </div>
    {message ? <p className="mt-3 text-sm text-muted" role="status">{message}</p> : null}
    {shipment && sender && recipient ? <div className="shipping-label-preview mt-4 rounded-xl border-2 border-black bg-white p-4 text-black" dir="rtl">
      <div className="grid gap-3">
        <AddressBlock title="فرستنده" data={sender} />
        <AddressBlock title="گیرنده" data={recipient} />
      </div>
      <div className="shipping-label-site mt-4 border-t-2 border-black pt-3 text-center text-base font-bold" dir="ltr">organicshahoo.ir</div>
    </div> : null}
    <style>{`
      @media print {
        @page { size: auto; margin: 0; }
        body[data-print-target="shipping-label"] * { visibility: hidden !important; }
        body[data-print-target="shipping-label"] .shipping-label-preview,
        body[data-print-target="shipping-label"] .shipping-label-preview * { visibility: visible !important; }
        body[data-print-target="shipping-label"] .shipping-label-preview { position: absolute; inset: 0 auto auto 0; width: 100%; border: 1.5px solid #000 !important; border-radius: 0; padding: 5mm; color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body[data-print-target="shipping-label"][data-label-size="100x150"] .shipping-label-preview { width: 100mm; min-height: 150mm; }
        body[data-print-target="shipping-label"][data-label-size="a4"] .shipping-label-preview { width: 190mm; min-height: 277mm; }
        body[data-print-target="shipping-label"] .shipping-label-toolbar { display: none !important; }
        body[data-print-target="shipping-label"] .shipping-label-preview section { border-color: #000 !important; }
        body[data-print-target="shipping-label"] .shipping-label-preview h4 { color: #000 !important; }
        body[data-print-target="shipping-label"] .shipping-label-site { border-color: #000 !important; }
      }
    `}</style>
  </section>;
}
function AddressBlock({ title, data }: { title: string; data: NonNullable<Address> }) {
  return <section className="rounded-lg border-2 border-black p-3 text-sm leading-7 text-black">
    <h4 className="mb-1 inline-block rounded-md bg-black px-3 py-1 font-bold text-white">{title}</h4>
    <p className="mt-1 text-lg font-black">{data.name || "—"}</p>
    <p dir="ltr" className="text-base font-semibold">{data.phone || "—"}</p>
    <p className="font-medium">{[data.province, data.city].filter(Boolean).join("، ") || "—"}</p>
    <p>{data.address || "—"}{data.plaque ? `، پلاک ${toPersianNum(data.plaque)}` : ""}{data.unit ? `، واحد ${toPersianNum(data.unit)}` : ""}</p>
    <div className="mt-2 border-t border-black pt-2 text-base font-black">کد پستی: <bdi dir="ltr">{data.postalCode ? toPersianNum(data.postalCode) : "—"}</bdi></div>
  </section>;
}
