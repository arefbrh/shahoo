import { useEffect, useState, type FormEvent } from "react";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import type { AddressRow } from "@/server/account/addresses";
import { listAddressesFn, removeAddressFn, saveAddressFn, setDefaultAddressFn } from "@/server/account/api";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";

type Address = AddressRow;
type AddressForm = Omit<Address, "id" | "isDefault"> & { id: string };
const empty: AddressForm = { id: "", label: "", recipientName: "", recipientMobile: "", province: "", city: "", addressLine: "", postalCode: "", plaque: "", unit: "" };

export function AddressBook() {
  const [rows, setRows] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressForm>(empty);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  async function reload() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await listAddressesFn();
      if (result.ok) setRows(result.addresses);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  async function run(action: () => Promise<{ ok: boolean; message?: string; addresses?: Address[] }>, success: string | null, failure: string) {
    if (pending) return false;
    setPending(true);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setMessage({ text: result.message || failure, error: true });
        return false;
      }
      if (result.addresses) setRows(result.addresses);
      if (success) setMessage({ text: success, error: false });
      return true;
    } catch {
      setMessage({ text: failure, error: true });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const { id, ...fields } = form;
    const saved = await run(() => saveAddressFn({ data: { ...fields, id: id || null } }), "نشانی ذخیره شد.", "نشانی ذخیره نشد. دوباره تلاش کنید.");
    if (saved) setForm(empty);
  }

  function change<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="mt-6 space-y-4" aria-labelledby="address-heading">
      <h2 id="address-heading" className="text-lg font-bold text-forest">نشانی‌های من</h2>
      {loading ? <p className="text-sm text-muted" role="status">در حال خواندن نشانی‌ها...</p> : null}
      {loadFailed ? (
        <div className="text-sm" role="alert">
          <p>نشانی‌ها خوانده نشد.</p>
          <button type="button" className={`mt-2 ${buttonGhost}`} onClick={() => void reload()}>تلاش دوباره</button>
        </div>
      ) : rows.length === 0 && !loadFailed && !loading ? (
        <p className={`${panelClass} p-4 text-sm leading-7 text-muted`}>هنوز نشانی ذخیره‌شده‌ای ندارید. می‌توانید از فرم زیر نشانی تازه‌ای اضافه کنید.</p>
      ) : null}
      {rows.map((row) => (
        <article key={row.id} className={`${panelClass} space-y-2 p-4 text-sm`}>
          <p className="font-bold text-forest">
            {row.label || "نشانی"} {row.isDefault ? <span className="rounded-full bg-forest px-2 py-1 text-xs text-ivory">نشانی پیش‌فرض</span> : null}
          </p>
          <p>گیرنده: {row.recipientName} · <span dir="ltr">{row.recipientMobile}</span></p>
          <p>{row.province}، {row.city}، {row.addressLine}{row.plaque ? `، پلاک ${row.plaque}` : ""}{row.unit ? `، واحد ${row.unit}` : ""}</p>
          <p className="text-muted">کد پستی: <span dir="ltr">{row.postalCode}</span></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonGhost} disabled={pending} onClick={() => { setForm({ ...row }); setMessage(null); }}>ویرایش</button>
            {!row.isDefault ? <button type="button" className={buttonGhost} disabled={pending} onClick={() => void run(() => setDefaultAddressFn({ data: { id: row.id } }), "نشانی پیش‌فرض تغییر کرد.", "تغییر نشانی پیش‌فرض انجام نشد.")}>انتخاب به‌عنوان پیش‌فرض</button> : null}
            <button
              type="button"
              className={buttonGhost}
              disabled={pending}
              onClick={() => {
                if (window.confirm("از حذف این نشانی مطمئن هستید؟")) {
                  void run(() => removeAddressFn({ data: { id: row.id } }), "نشانی حذف شد.", "حذف نشانی انجام نشد.");
                  if (form.id === row.id) setForm(empty);
                }
              }}
            >حذف</button>
          </div>
        </article>
      ))}
      <form onSubmit={save} className={`${panelClass} space-y-3 p-4`}>
        <h3 className="font-bold text-forest">{form.id ? "ویرایش نشانی" : "افزودن نشانی تازه"}</h3>
        <label className="block text-sm font-bold text-forest">عنوان نشانی (اختیاری)
          <input className={`${fieldClass} mt-2`} placeholder="مثلاً منزل یا محل کار" value={form.label} onChange={(event) => change("label", event.target.value)} maxLength={40} />
        </label>
        <label className="block text-sm font-bold text-forest">نام گیرنده
          <input className={`${fieldClass} mt-2`} autoComplete="name" value={form.recipientName} onChange={(event) => change("recipientName", event.target.value)} maxLength={80} required />
        </label>
        <label className="block text-sm font-bold text-forest">شماره موبایل گیرنده
          <input className={`${fieldClass} mt-2 text-left`} value={form.recipientMobile} onChange={(event) => change("recipientMobile", event.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} required />
        </label>
        <label className="block text-sm font-bold text-forest">استان
          <select className={`${fieldClass} mt-2`} aria-label="استان" value={form.province} onChange={(event) => change("province", event.target.value)} required>
            <option value="">انتخاب استان</option>
            {IRAN_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold text-forest">شهر
          <input className={`${fieldClass} mt-2`} value={form.city} onChange={(event) => change("city", event.target.value)} maxLength={40} required />
        </label>
        <label className="block text-sm font-bold text-forest">نشانی کامل
          <textarea className={`${fieldClass} mt-2 min-h-24`} value={form.addressLine} onChange={(event) => change("addressLine", event.target.value)} maxLength={300} required />
        </label>
        <label className="block text-sm font-bold text-forest">کد پستی
          <input aria-label="کد پستی" className={`${fieldClass} mt-2 text-left`} value={form.postalCode} onChange={(event) => change("postalCode", event.target.value)} inputMode="numeric" dir="ltr" maxLength={20} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold text-forest">پلاک (اختیاری)
            <input className={`${fieldClass} mt-2`} value={form.plaque} onChange={(event) => change("plaque", event.target.value)} maxLength={20} />
          </label>
          <label className="block text-sm font-bold text-forest">واحد (اختیاری)
            <input className={`${fieldClass} mt-2`} value={form.unit} onChange={(event) => change("unit", event.target.value)} maxLength={20} />
          </label>
        </div>
        {message ? <p className="text-sm font-bold text-forest" role={message.error ? "alert" : "status"}>{message.text}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className={buttonPrimary} type="submit" disabled={pending}>{pending ? "در حال ذخیره" : form.id ? "ذخیره ویرایش" : "افزودن نشانی"}</button>
          {form.id ? <button className={buttonGhost} type="button" disabled={pending} onClick={() => setForm(empty)}>انصراف از ویرایش</button> : null}
        </div>
      </form>
    </section>
  );
}
