import { useEffect, useState } from "react";
import { getShippingSenderProfileFn, saveShippingSenderProfileFn } from "@/server/commerce/fulfillment-api";

type SenderProfile = { name: string; phone: string; province: string; city: string; address: string; postalCode: string };
const empty: SenderProfile = { name: "", phone: "", province: "", city: "", address: "", postalCode: "" };

export function ShippingSenderSettings() {
  const [value, setValue] = useState<SenderProfile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    getShippingSenderProfileFn().then((profile) => { if (active) setValue(profile); })
      .catch(() => { if (active) setMessage("خواندن مشخصات فرستنده انجام نشد."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function set<K extends keyof SenderProfile>(key: K, next: SenderProfile[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }
  async function save() {
    setSaving(true); setMessage("");
    try {
      const result = await saveShippingSenderProfileFn({ data: value });
      setMessage(result.message);
    } catch { setMessage("ذخیره مشخصات فرستنده انجام نشد؛ دسترسی orders.write را بررسی کنید."); }
    finally { setSaving(false); }
  }
  const fields: Array<{ key: keyof SenderProfile; label: string; required?: boolean }> = [
    { key: "name", label: "نام فرستنده", required: true },
    { key: "phone", label: "تلفن فرستنده", required: true },
    { key: "province", label: "استان" },
    { key: "city", label: "شهر", required: true },
    { key: "address", label: "نشانی کامل", required: true },
    { key: "postalCode", label: "کد پستی" },
  ];
  return <section className="my-5 rounded-2xl border border-line bg-white p-4" dir="rtl">
    <h2 className="font-bold text-forest">مشخصات مرکزی فرستنده</h2>
    <p className="mt-1 text-xs text-muted">این اطلاعات برای برچسب مرسوله استفاده و هنگام ثبت ارسال در همان مرسوله ذخیره می‌شود.</p>
    {loading ? <p className="mt-3 text-sm text-muted">در حال دریافت…</p> : null}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {fields.map((field) => <label key={field.key} className="text-xs font-bold text-muted">{field.label}{field.required ? " *" : ""}
        {field.key === "address" ? <textarea rows={2} maxLength={500} required={field.required} value={value[field.key]} onChange={(e) => set(field.key, e.target.value)} className="mt-1 w-full rounded-xl border border-line p-3 text-sm text-forest" /> :
        <input maxLength={field.key === "name" ? 100 : field.key === "phone" ? 40 : field.key === "postalCode" ? 20 : 80} required={field.required} value={value[field.key]} onChange={(e) => set(field.key, e.target.value)} className="mt-1 w-full rounded-xl border border-line p-3 text-sm text-forest" />}
      </label>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={loading || saving} onClick={save} className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "در حال ذخیره…" : "ذخیره فرستنده"}</button>{message ? <p role="status" className="text-sm text-forest">{message}</p> : null}</div>
  </section>;
}
