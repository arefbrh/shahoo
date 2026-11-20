import { useEffect, useState } from "react";
import type { OfferCoupon, OfferDesk, OfferShipping } from "@/lib/offer-types";
import { parseWhole } from "@/lib/catalog-rules";
import { toPersianNum } from "@/lib/format";
import { getOfferDesk, saveCouponFn, saveShippingFn } from "@/server/offers/api";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";
import { AdminHelp } from "./admin-help";

export function OffersDesk({ canWrite = true }: { canWrite?: boolean }) {
  const [desk, setDesk] = useState<OfferDesk | null>(null);
  const [error, setError] = useState("");
  const [couponId, setCouponId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);

  async function reload() {
    setDesk(await getOfferDesk());
  }

  useEffect(() => {
    void reload().catch(() => setError("تخفیف و ارسال خوانده نشد."));
  }, []);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-forest">تخفیف و ارسال</h2><AdminHelp title="تخفیف و ارسال" example="کد NOWRUZ با نوع درصد، مقدار ۱۰، حداقل سبد ۵۰۰۰۰۰ و سقف استفاده ۱۰۰ یعنی ۱۰٪ تخفیف برای سبدهای واجد شرایط، تا سقف تعداد استفاده ثبت‌شده.">کدهای تخفیف و روش‌های ارسال روی محاسبه سفارش‌های جدید اثر دارند؛ سفارش‌های قبلی با مبلغ زمان ثبت خود باقی می‌مانند. پس از تغییر، یک سبد آزمایشی در Preview بررسی کنید. این تنظیمات به‌تنهایی اتصال واقعی به شرکت حمل یا درگاه پرداخت ایجاد نمی‌کنند.</AdminHelp>
      <p className="mt-1 text-sm leading-7 text-muted">
        کد و هزینه ارسال از اینجا عوض می‌شود. هیچ درگاهی صدا زده نمی‌شود و سفارش پرداخت‌شده ساخته نمی‌شود.
      </p>
      {error ? <p className="mt-3 text-sm font-bold text-forest">{error}</p> : null}
      {!desk ? <p className="mt-4 text-sm">در حال خواندن...</p> : null}
      {desk ? (
        <>
          <CouponEditor
            key={couponId ?? "new-coupon"}
            coupons={desk.coupons}
            editing={desk.coupons.find((row) => row.id === couponId) ?? null}
            onEdit={setCouponId}
            canWrite={canWrite}
            onSaved={async (message) => {
              setError(message);
              setCouponId(null);
              await reload();
            }}
          />
          <ShippingEditor
            key={methodId ?? "new-method"}
            methods={desk.methods}
            editing={desk.methods.find((row) => row.id === methodId) ?? null}
            onEdit={setMethodId}
            canWrite={canWrite}
            onSaved={async (message) => {
              setError(message);
              setMethodId(null);
              await reload();
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function CouponEditor({
  coupons,
  editing,
  onEdit,
  onSaved,
  canWrite,
}: {
  coupons: OfferCoupon[];
  editing: OfferCoupon | null;
  onEdit: (id: string | null) => void;
  onSaved: (message: string) => Promise<void>;
  canWrite: boolean;
}) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [mode, setMode] = useState<"percent" | "amount">(editing?.mode ?? "percent");
  const [percent, setPercent] = useState(editing?.percent ? String(editing.percent) : "");
  const [amount, setAmount] = useState(editing?.amountToman ? String(editing.amountToman) : "");
  const [minimum, setMinimum] = useState(editing ? String(editing.minSubtotalToman) : "0");
  const [limit, setLimit] = useState(editing?.usageLimit ? String(editing.usageLimit) : "");
  const [startsOn, setStartsOn] = useState(editing?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(editing?.endsOn ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    const percentValue = mode === "percent" ? parseWhole(percent) : null;
    const amountValue = mode === "amount" ? parseWhole(amount) : null;
    const minValue = parseWhole(minimum);
    const limitValue = limit.trim() ? parseWhole(limit) : null;
    if (minValue === null || (limit.trim() && limitValue === null)) {
      setMessage("حداقل سبد و سقف استفاده را عددی بنویسید.");
      return;
    }
    try {
      const result = await saveCouponFn({
        data: {
          id: editing?.id,
          code,
          description,
          mode,
          percent: percentValue,
          amountToman: amountValue,
          minSubtotalToman: minValue,
          usageLimit: limitValue,
          startsOn,
          endsOn,
          isActive,
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await onSaved("");
    } catch {
      setMessage("ذخیره انجام نشد.");
    }
  }

  return (
    <div className={`${panelClass} mt-4 space-y-3 p-4`}>
      <h3 className="font-bold text-forest">{editing ? "ویرایش کد" : "کد تازه"}</h3><p className="text-xs leading-6 text-muted">کد را کوتاه و بدون فاصله بنویسید؛ نوع درصدی یا مبلغ ثابت را انتخاب کنید. حداقل سبد و بازه زمانی اختیاری‌اند؛ سقف استفاده خالی یعنی محدودیت تعداد تعریف نشده است.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="کد" value={code} ltr onChange={setCode} hint="کدی که مشتری در سبد وارد می‌کند؛ بدون فاصله. نمونه: NOWRUZ10." />
        <Field label="توضیح" value={description} onChange={setDescription} />
        <label className="text-sm font-bold text-forest">
          نوع
          <select value={mode} onChange={(event) => setMode(event.target.value === "amount" ? "amount" : "percent")} className={`${fieldClass} mt-2`}>
            <option value="percent">درصد</option>
            <option value="amount">مبلغ تومان</option>
          </select>
        </label>
        {mode === "percent" ? (
          <Field label="درصد" value={percent} ltr onChange={setPercent} hint="عدد درصد تخفیف؛ نمونه ۱۰ یعنی ده درصد." />
        ) : (
          <Field label="مبلغ تومان" value={amount} ltr onChange={setAmount} hint="مبلغ ثابت تخفیف به تومان؛ فقط عدد وارد کنید." />
        )}
        <Field label="حداقل سبد، تومان" value={minimum} ltr onChange={setMinimum} hint="کمترین مبلغ سبد برای فعال‌شدن کد؛ صفر یا خالی یعنی حداقل ندارد." />
        <Field label="سقف استفاده، خالی یعنی نامحدود" value={limit} ltr onChange={setLimit} />
        <Field label="شروع" value={startsOn} ltr onChange={setStartsOn} type="date" />
        <Field label="پایان" value={endsOn} ltr onChange={setEndsOn} type="date" />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        فعال
      </label>
      {editing ? <p className="text-xs text-muted">استفاده‌شده: {toPersianNum(editing.usedCount)}. این عدد از اینجا عوض نمی‌شود.</p> : null}
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonPrimary} onClick={() => void save()}>
            ذخیره کد
          </button>
          {editing ? (
            <button type="button" className={buttonGhost} onClick={() => onEdit(null)}>
              کد تازه
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">مشاهده فقط. ویرایش کد برای نقش شما باز نیست.</p>
      )}
      <ul className="space-y-2">
        {coupons.map((coupon) => (
          <li key={coupon.id}>
            <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-start text-sm" onClick={() => onEdit(coupon.id)}>
              <span className="font-bold text-forest" dir="ltr">
                {coupon.code}
              </span>
              <span className="text-muted">
                {coupon.mode === "percent" ? `${toPersianNum(coupon.percent ?? 0)}٪` : `${toPersianNum(coupon.amountToman ?? 0)} تومان`}
                {coupon.isActive ? "" : " · خاموش"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShippingEditor({
  methods,
  editing,
  onEdit,
  onSaved,
  canWrite,
}: {
  methods: OfferShipping[];
  editing: OfferShipping | null;
  onEdit: (id: string | null) => void;
  onSaved: (message: string) => Promise<void>;
  canWrite: boolean;
}) {
  const [key, setKey] = useState(editing?.key ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [price, setPrice] = useState(editing ? String(editing.priceToman) : "");
  const [freeOver, setFreeOver] = useState(editing?.freeOverToman === null || editing?.freeOverToman === undefined ? "" : String(editing.freeOverToman));
  const [sortOrder, setSortOrder] = useState(editing ? String(editing.sortOrder) : String(methods.length + 1));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    const priceValue = parseWhole(price);
    const freeValue = freeOver.trim() ? parseWhole(freeOver) : null;
    const sortValue = parseWhole(sortOrder);
    if (priceValue === null || sortValue === null || (freeOver.trim() && freeValue === null)) {
      setMessage("هزینه، آستانه و ترتیب را عددی بنویسید.");
      return;
    }
    try {
      const result = await saveShippingFn({
        data: {
          id: editing?.id,
          key,
          title,
          description,
          priceToman: priceValue,
          freeOverToman: freeValue,
          sortOrder: sortValue,
          isActive,
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await onSaved("");
    } catch {
      setMessage("ذخیره انجام نشد.");
    }
  }

  return (
    <div className={`${panelClass} mt-4 space-y-3 p-4`}>
      <h3 className="font-bold text-forest">{editing ? "ویرایش ارسال" : "روش ارسال تازه"}</h3>
      <p className="text-xs leading-6 text-muted">این فرم فقط گزینه و هزینه‌ای را که مشتری هنگام تسویه می‌بیند تنظیم می‌کند؛ اتصال یا برچسب خودکار پست/تیپاکس ایجاد نمی‌شود. «رایگان از» حداقل مبلغ سبد برای صفرشدن هزینه این روش است. مثال: هزینه ۶۰۰۰۰ تومان و رایگان از ۱۰۰۰۰۰۰ تومان.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان" value={title} onChange={setTitle} hint="نام قابل مشاهده برای مشتری؛ نمونه: ارسال با پست پیشتاز." />
        <Field label="شناسه انگلیسی" value={key} ltr onChange={setKey} disabled={Boolean(editing)} hint="شناسه داخلی یکتا؛ فقط حروف کوچک انگلیسی و خط تیره، نمونه: post-express. پس از ساخت قابل تغییر نیست." />
        <Field label="توضیح" value={description} onChange={setDescription} />
        <Field label="هزینه، تومان" value={price} ltr onChange={setPrice} hint="هزینه‌ای که به سفارش افزوده می‌شود؛ فقط عدد تومان." />
        <Field label="رایگان از، تومان" value={freeOver} ltr onChange={setFreeOver} hint="از این مبلغ سبد به بالا هزینه این روش صفر می‌شود؛ خالی یعنی ارسال رایگان خودکار نداریم." />
        <Field label="ترتیب" value={sortOrder} ltr onChange={setSortOrder} />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        فعال در تسویه
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonPrimary} onClick={() => void save()}>
            ذخیره ارسال
          </button>
        {editing ? (
          <button type="button" className={buttonGhost} onClick={() => onEdit(null)}>
            روش تازه
          </button>
        ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">مشاهده فقط. ویرایش ارسال برای نقش شما باز نیست.</p>
      )}
      <ul className="space-y-2">
        {methods.map((method) => (
          <li key={method.id}>
            <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-start text-sm" onClick={() => onEdit(method.id)}>
              <span className="font-bold text-forest">{method.title}</span>
              <span className="text-muted">{method.isActive ? "فعال" : "خاموش"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ltr = false,
  type = "text",
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ltr?: boolean;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-bold text-forest">
      {label}
      <input
        type={type}
        value={value}
        disabled={disabled}
        dir={ltr ? "ltr" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} mt-2 ${ltr ? "text-left" : ""}`}
      />
      {hint ? <span className="mt-1 block text-xs font-normal leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}
