import { useEffect, useState, type FormEvent } from "react";
import type { AdminCatalog, AdminProduct, AdminVariant } from "@/lib/catalog-types";
import { toPersianNum } from "@/lib/format";
import { adjustInventoryFn, attachProductMediaFn, detachProductImageFn, getAdminCatalog, reorderProductImagesFn, saveCategoryFn, saveProductFn } from "@/server/catalog/api";
import { parseWhole } from "@/lib/catalog-rules";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";

type DraftVariant = {
  id?: string;
  sku: string;
  label: string;
  unitKind: "volume" | "weight" | "custom";
  amount: string;
  priceToman: string;
  compareAtToman: string;
  isDefault: boolean;
  status: "active" | "inactive";
  openingOnHand: string;
  onHand: number;
  reserved: number;
};

export function CatalogDesk({ canWrite, canInventory }: { canWrite: boolean; canInventory: boolean }) {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | "new" | null>(null);

  async function reload() {
    const next = await getAdminCatalog();
    setCatalog(next);
  }

  useEffect(() => {
    void reload().catch(() => setError("کاتالوگ خوانده نشد."));
  }, []);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-forest">کاتالوگ</h2>
          <p className="mt-1 text-sm leading-7 text-muted">
            دسته، بسته‌بندی، نام انگلیسی و تصویر از کتابخانه رسانه یا نشانی https از اینجا عوض می‌شود. بسته ذخیره‌شده حذف نمی‌شود؛ غیرفعال کنید.
          </p>
        </div>
        {canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setSelected("new")}>
            محصول تازه
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm font-bold text-forest">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm font-bold text-forest">{notice}</p> : null}
      {!catalog ? <p className="mt-4 text-sm">در حال خواندن کاتالوگ...</p> : null}
      {catalog ? (
        <CategoryForm
          catalog={catalog}
          canWrite={canWrite}
          onSaved={() => {
            setError("");
            void reload().catch(() => setError("کاتالوگ خوانده نشد."));
          }}
        />
      ) : null}
      <ul className="mt-4 space-y-2">
        {catalog?.products.map((product) => (
          <li key={product.id}>
            <button type="button" className={`${panelClass} w-full px-4 py-3 text-start text-sm`} onClick={() => setSelected(product.id)}>
              <span className="flex items-center justify-between gap-3">
                <span className="font-bold text-forest">{product.name}</span>
                <span className="text-muted">{product.status === "published" ? "منتشرشده" : "پیش‌نویس"}</span>
              </span>
              <span className="mt-1 block text-muted">{toPersianNum(product.variants.length)} بسته</span>
            </button>
          </li>
        ))}
      </ul>
      {catalog && catalog.products.length === 0 ? <p className="mt-4 text-sm text-muted">هنوز محصولی ثبت نشده است.</p> : null}
      {catalog && selected ? (
        <ProductEditor
          key={selected}
          catalog={catalog}
          product={selected === "new" ? null : (catalog.products.find((item) => item.id === selected) ?? null)}
          canWrite={canWrite}
          canInventory={canInventory}
          onClose={() => setSelected(null)}
          onSaved={async (message) => {
            setNotice(message);
            setError("");
            await reload();
          }}
          onRefresh={async () => {
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}

function CategoryForm({
  catalog,
  canWrite,
  onSaved,
}: {
  catalog: AdminCatalog;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [shortName, setShortName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconType, setIconType] = useState("herbs");
  const [sortOrder, setSortOrder] = useState(String(catalog.categories.length + 1));
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  if (!canWrite) return null;

  function load(category: AdminCatalog["categories"][number]) {
    setEditingId(category.id);
    setName(category.name);
    setEnglishName(category.englishName);
    setShortName(category.shortName);
    setSlug(category.slug);
    setDescription(category.description);
    setIconType(category.iconType);
    setSortOrder(String(category.sortOrder));
    setMessage("");
  }

  function reset() {
    setEditingId(null);
    setName("");
    setEnglishName("");
    setShortName("");
    setSlug("");
    setDescription("");
    setIconType("herbs");
    setSortOrder(String(catalog.categories.length + 1));
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const order = parseWhole(sortOrder);
    if (order === null || order < 0 || order > 999) {
      setMessage("ترتیب نمایش باید یک عدد صحیح بین صفر تا ۹۹۹ باشد.");
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setMessage("نام دسته باید حداقل ۲ نویسه داشته باشد.");
      return;
    }
    if (!shortName.trim() || shortName.trim().length < 2) {
      setMessage("نام کوتاه باید حداقل ۲ نویسه داشته باشد.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) {
      setMessage("شناسه انگلیسی فقط حروف کوچک، عدد و خط تیره داشته باشد؛ نمونه: cold-pressed-oils");
      return;
    }
    const current = editingId ? catalog.categories.find((category) => category.id === editingId) : undefined;
    setPending(true);
    setMessage("");
    try {
      const result = await saveCategoryFn({
        data: {
          id: editingId ?? undefined,
          name,
          englishName,
          shortName,
          slug,
          description,
          iconType,
          isActive: current?.isActive ?? true,
          sortOrder: order,
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      reset();
      onSaved();
    } catch (error) {
      setMessage(getCatalogActionError(error, "ذخیره دسته انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={`${panelClass} mt-4 grid gap-3 p-4 sm:grid-cols-4`} onSubmit={(event) => void submit(event)}>
      <div className="sm:col-span-4">
        <h3 className="font-bold text-forest">{editingId ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی"}</h3>
        <p className="mt-1 text-xs leading-6 text-muted">
          نام دسته در فروشگاه دیده می‌شود؛ نام کوتاه برای نمایش فشرده است؛ شناسه انگلیسی در آدرس صفحه استفاده می‌شود و باید یکتا باشد.
        </p>
      </div>
      <label className="text-sm font-bold text-forest">
        نام دسته *
        <input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً روغن‌های گیاهی" className={`${fieldClass} mt-2`} />
      </label>
      <label className="text-sm font-bold text-forest">
        نام انگلیسی
        <input maxLength={80} value={englishName} onChange={(event) => setEnglishName(event.target.value)} placeholder="مثلاً Herbal Oils" dir="ltr" className={`${fieldClass} mt-2 text-left`} />
      </label>
      <label className="text-sm font-bold text-forest">
        نام کوتاه *
        <input required minLength={2} maxLength={40} value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="مثلاً روغن" className={`${fieldClass} mt-2`} />
      </label>
      <label className="text-sm font-bold text-forest">
        شناسه انگلیسی (Slug) *
        <input required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="herbal-oils" dir="ltr" className={`${fieldClass} mt-2 text-left`} />
        <span className="mt-1 block text-xs font-normal text-muted">برای نشانی صفحه است؛ فاصله و حروف فارسی نداشته باشد.</span>
      </label>
      <label className="text-sm font-bold text-forest">
        نشان دسته
        <select value={iconType} onChange={(event) => setIconType(event.target.value)} className={`${fieldClass} mt-2`}>
          <option value="oils">روغن</option>
          <option value="butters">کره</option>
          <option value="nuts">آجیل</option>
          <option value="herbs">گیاه</option>
        </select>
      </label>
      <label className="text-sm font-bold text-forest sm:col-span-2">
        توضیح کوتاه
        <input maxLength={400} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="توضیحی که در صفحه دسته نمایش داده می‌شود" className={`${fieldClass} mt-2`} />
      </label>
      <label className="text-sm font-bold text-forest">
        ترتیب نمایش
        <input required value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} placeholder="۱" aria-label="ترتیب دسته" inputMode="numeric" dir="ltr" className={`${fieldClass} mt-2 text-left`} />
        <span className="mt-1 block text-xs font-normal text-muted">عدد کمتر یعنی نمایش زودتر.</span>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن دسته"}
        </button>
        {editingId ? <button type="button" disabled={pending} className={buttonGhost} onClick={reset}>لغو ویرایش</button> : null}
      </div>
      {message ? <p role="alert" className="text-sm font-bold text-forest sm:col-span-4">{message}</p> : null}
      <ul className="space-y-2 sm:col-span-4">
        {catalog.categories.map((category) => (
          <li key={category.id} className="flex min-h-11 flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-bold text-forest">{category.name}<span className="ms-2 text-xs font-normal text-muted" dir="ltr">{category.slug}</span></span>
            <span className="flex items-center gap-3">
              <button type="button" className="font-bold text-gold" onClick={() => load(category)}>ویرایش</button>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={category.isActive}
                  onChange={async (event) => {
                    setMessage("");
                    try {
                      const result = await saveCategoryFn({
                        data: {
                          id: category.id,
                          name: category.name,
                          englishName: category.englishName,
                          shortName: category.shortName,
                          slug: category.slug,
                          description: category.description,
                          iconType: category.iconType,
                          isActive: event.target.checked,
                          sortOrder: category.sortOrder,
                        },
                      });
                      if (!result.ok) setMessage(result.message);
                      else onSaved();
                    } catch (error) {
                      setMessage(getCatalogActionError(error, "وضعیت دسته تغییر نکرد. دوباره تلاش کنید."));
                    }
                  }}
                />
                فعال در فروشگاه
              </label>
            </span>
          </li>
        ))}
      </ul>
    </form>
  );
}

function ProductEditor({
  catalog,
  product,
  canWrite,
  canInventory,
  onClose,
  onSaved,
  onRefresh,
}: {
  catalog: AdminCatalog;
  product: AdminProduct | null;
  canWrite: boolean;
  canInventory: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [englishName, setEnglishName] = useState(product?.englishName ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "");
  const [homepageTitle, setHomepageTitle] = useState(product?.homepageTitle ?? product?.name ?? "");
  const [homepageSubtitle, setHomepageSubtitle] = useState(product?.homepageSubtitle ?? "");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [fullDescription, setFullDescription] = useState(product?.fullDescription ?? "");
  const [origin, setOrigin] = useState(product?.origin ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const [usageInstructions, setUsageInstructions] = useState(product?.usageInstructions ?? "");
  const [storageInstructions, setStorageInstructions] = useState(product?.storageInstructions ?? "");
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product?.seoDescription ?? "");
  const [specs, setSpecs] = useState(product?.specs ?? []);
  const [intendedUse, setIntendedUse] = useState<string[]>(product?.oilFinder?.intendedUse ?? []);
  const [texture, setTexture] = useState(product?.oilFinder?.texture ?? "");
  const [scent, setScent] = useState(product?.oilFinder?.scent ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? catalog.categories[0]?.id ?? "");
  const [status, setStatus] = useState<"draft" | "published">(product?.status === "published" ? "published" : "draft");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isOrganic, setIsOrganic] = useState(product?.isOrganic ?? false);
  const [isBestSeller, setIsBestSeller] = useState(product?.isBestSeller ?? false);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [variants, setVariants] = useState<DraftVariant[]>(
    product?.variants.map(toDraft) ?? [
      {
        sku: "",
        label: "",
        unitKind: "volume",
        amount: "250",
        priceToman: "",
        compareAtToman: "",
        isDefault: true,
        status: "active",
        openingOnHand: "0",
        onHand: 0,
        reserved: 0,
      },
    ],
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [galleryPending, setGalleryPending] = useState(false);
  const [mediaQuery, setMediaQuery] = useState("");

  function patch(index: number, patch: Partial<DraftVariant>) {
    setVariants((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function linkMedia(mediaId: string, publicUrl: string, primary: boolean) {
    if (!product) return;
    setMessage("");
    const result = await attachProductMediaFn({ data: { productId: product.id, mediaId, primary } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (primary) setImageUrl(publicUrl);
    setMessage(primary ? "تصویر اصلی وصل شد." : "تصویر به گالری اضافه شد.");
    await onRefresh();
  }

  async function unlink(imageId: string) {
    setMessage("");
    const result = await detachProductImageFn({ data: { imageId } });
    setMessage(result.ok ? "تصویر از گالری برداشته شد." : result.message);
    if (result.ok) await onRefresh();
  }

  async function moveGallery(index: number, delta: number) {
    if (!product || galleryPending) return;
    const target = index + delta;
    if (target < 0 || target >= product.gallery.length) return;
    const ids = product.gallery.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setGalleryPending(true);
    setMessage("");
    try {
      const result = await reorderProductImagesFn({ data: { productId: product.id, ids } });
      setMessage(result.ok ? "ترتیب گالری ذخیره شد." : result.message);
      if (result.ok) await onRefresh();
    } catch {
      setMessage("ترتیب گالری ذخیره نشد؛ فهرست تصاویر را تازه کنید.");
    } finally {
      setGalleryPending(false);
    }
  }

  async function save() {
    setMessage("");
    setPending(true);
    try {
      if (!categoryId) {
        setMessage("ابتدا یک دسته‌بندی بسازید و سپس محصول را ثبت کنید.");
        return;
      }
      if (name.trim().length < 2) {
        setMessage("نام محصول باید حداقل ۲ نویسه داشته باشد.");
        return;
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug.trim())) {
        setMessage("شناسه انگلیسی محصول معتبر نیست؛ نمونه: cold-pressed-oil");
        return;
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(sku.trim())) {
        setMessage("کد محصول معتبر نیست؛ فقط حروف انگلیسی، عدد و خط تیره استفاده کنید.");
        return;
      }
      const payloadVariants = variants.map((variant) => {
        const price = parseWhole(variant.priceToman);
        const compareText = variant.compareAtToman.trim();
        const compare = compareText ? parseWhole(compareText) : null;
        const amount = variant.unitKind === "custom" ? null : parseWhole(variant.amount);
        const opening = parseWhole(variant.openingOnHand) ?? 0;
        return {
          id: variant.id,
          sku: variant.sku,
          label: variant.label,
          unitKind: variant.unitKind,
          amount,
          priceToman: price ?? Number.NaN,
          compareAtToman: compare,
          compareInvalid: Boolean(compareText) && compare === null,
          isDefault: variant.isDefault,
          status: variant.status,
          openingOnHand: variant.id || !canInventory ? undefined : opening,
        };
      });
      if (payloadVariants.some((variant) => variant.compareInvalid)) {
        setMessage("قیمت قبل از تخفیف را درست بنویسید یا خالی بگذارید.");
        return;
      }
      if (payloadVariants.some((variant) => !Number.isInteger(variant.priceToman))) {
        setMessage("قیمت هر بسته را به تومان و بدون اعشار بنویسید.");
        return;
      }
      const result = await saveProductFn({
        data: {
          id: product?.id,
          categoryId,
          name,
          englishName,
          subtitle,
          homepageTitle,
          homepageSubtitle,
          slug,
          sku,
          status,
          shortDescription,
          fullDescription,
          origin,
          ingredients,
          usageInstructions,
          storageInstructions,
          seoTitle,
          seoDescription,
          oilFinder: intendedUse.length || texture || scent ? { intendedUse, texture, scent } : null,
          specs,
          isOrganic,
          isBestSeller,
          isFeatured,
          imageUrl,
          variants: payloadVariants.map(({ compareInvalid: _ignored, ...variant }) => variant),
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await onSaved("محصول ذخیره شد.");
      onClose();
    } catch (error) {
      setMessage(getCatalogActionError(error, "ذخیره محصول انجام نشد. فیلدهای اجباری، کدها و قیمت بسته‌ها را بررسی کنید."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`${panelClass} mt-4 space-y-4 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-forest">{product ? product.name : "محصول تازه"}</h3>
          <p className="mt-1 text-xs leading-6 text-muted">فیلدهای دارای * اجباری‌اند. ابتدا اطلاعات پایه و حداقل یک بسته با کد یکتا و قیمت تومان را کامل کنید؛ برای انتشار، حداقل یک بسته باید فعال باشد.</p>
        </div>
        <button type="button" className={buttonGhost} onClick={onClose}>
          بستن
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام محصول" value={name} onChange={setName} disabled={!canWrite} required />
        <Field label="نام انگلیسی" value={englishName} onChange={setEnglishName} disabled={!canWrite} ltr />
        <Field label="شناسه انگلیسی (Slug)" value={slug} onChange={setSlug} disabled={!canWrite} ltr required hint="در آدرس صفحه محصول استفاده می‌شود؛ فقط حروف انگلیسی کوچک، عدد و خط تیره. نمونه: cold-pressed-oil" />
        <Field label="کد محصول (SKU)" value={sku} onChange={setSku} disabled={!canWrite} ltr required hint="کد یکتا برای شناسایی محصول در انبار و گزارش‌ها؛ نمونه: OLIVE-OIL" />
        <label className="text-sm font-bold text-forest">
          دسته
          <select value={categoryId} disabled={!canWrite} onChange={(event) => setCategoryId(event.target.value)} className={`${fieldClass} mt-2`}>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="زیرعنوان" value={subtitle} onChange={setSubtitle} disabled={!canWrite} />
        <label className="text-sm font-bold text-forest">
          وضعیت
          <select
            value={status}
            disabled={!canWrite}
            onChange={(event) => setStatus(event.target.value === "published" ? "published" : "draft")}
            className={`${fieldClass} mt-2`}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
          </select>
        </label>
      </div>
      <Field label="توضیح کوتاه" value={shortDescription} onChange={setShortDescription} disabled={!canWrite} />
      <label className="block text-sm font-bold text-forest">
        توضیح کامل
        <textarea value={fullDescription} disabled={!canWrite} onChange={(event) => setFullDescription(event.target.value)} className={`${fieldClass} mt-2 min-h-24 py-3`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان نمایش در صفحه اول" value={homepageTitle} onChange={setHomepageTitle} disabled={!canWrite} />
        <Field label="زیرعنوان نمایش در صفحه اول" value={homepageSubtitle} onChange={setHomepageSubtitle} disabled={!canWrite} />
        <Field label="منشأ" value={origin} onChange={setOrigin} disabled={!canWrite} />
        <Field label="ترکیبات" value={ingredients} onChange={setIngredients} disabled={!canWrite} />
        <label className="block text-sm font-bold text-forest">
          روش مصرف
          <textarea value={usageInstructions} disabled={!canWrite} onChange={(event) => setUsageInstructions(event.target.value)} className={`${fieldClass} mt-2 min-h-20 py-3`} />
        </label>
        <label className="block text-sm font-bold text-forest">
          روش نگهداری
          <textarea value={storageInstructions} disabled={!canWrite} onChange={(event) => setStorageInstructions(event.target.value)} className={`${fieldClass} mt-2 min-h-20 py-3`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان سئو محصول" value={seoTitle} onChange={setSeoTitle} disabled={!canWrite} />
        <label className="block text-sm font-bold text-forest">
          شرح سئو محصول
          <textarea value={seoDescription} disabled={!canWrite} onChange={(event) => setSeoDescription(event.target.value)} className={`${fieldClass} mt-2 min-h-20 py-3`} />
        </label>
      </div>
      <fieldset className="space-y-3 rounded-2xl border border-line p-3">
        <legend className="px-1 text-sm font-bold text-forest">اطلاعات راهنمای انتخاب روغن (اختیاری)</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            ["skin", "مراقبت پوست و ماساژ"],
            ["hair", "ساقه مو"],
            ["cooking", "سالاد و پخت ملایم"],
            ["general", "آشنایی کلی"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={intendedUse.includes(value!)}
                disabled={!canWrite}
                onChange={() => setIntendedUse((current) => current.includes(value!) ? current.filter((item) => item !== value) : [...current, value!])}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-forest">بافت
            <select value={texture} disabled={!canWrite} onChange={(event) => setTexture(event.target.value)} className={`${fieldClass} mt-2`}>
              <option value="">بدون انتخاب</option><option value="light">سبک</option><option value="rich">غلیظ</option>
            </select>
          </label>
          <label className="text-sm font-bold text-forest">عطر
            <select value={scent} disabled={!canWrite} onChange={(event) => setScent(event.target.value)} className={`${fieldClass} mt-2`}>
              <option value="">بدون انتخاب</option><option value="mild">ملایم</option><option value="herbal">گیاهی</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-2xl border border-line p-3">
        <legend className="px-1 text-sm font-bold text-forest">ویژگی‌های محصول</legend>
        {canWrite && specs.length < 12 && <label>افزودن مشخصات برچسب یا گواهی
          <select className={fieldClass} value="" onChange={(event) => {
            const label = event.target.value;
            if (label) setSpecs((current) => [...current, { label, value: "" }]);
          }}>
            <option value="">انتخاب مشخصه…</option>
            {["مواد حساسیت‌زا", "نوع مصرف", "ماندگاری پس از باز شدن", "شماره گواهی", "صادرکننده گواهی", "اعتبار گواهی"].filter((label) => !specs.some((spec) => spec.label === label)).map((label) => <option key={label}>{label}</option>)}
          </select>
        </label>}
        {specs.map((spec, index) => (
          <div key={`spec-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input className={fieldClass} value={spec.label} disabled={!canWrite} aria-label={`نام ویژگی ${index + 1}`} placeholder="عنوان ویژگی" onChange={(event) => setSpecs((current) => current.map((item, row) => row === index ? { ...item, label: event.target.value } : item))} />
            <input className={fieldClass} value={spec.value} disabled={!canWrite} aria-label={`مقدار ویژگی ${index + 1}`} placeholder="مقدار" onChange={(event) => setSpecs((current) => current.map((item, row) => row === index ? { ...item, value: event.target.value } : item))} />
            {canWrite ? <button type="button" className={buttonGhost} onClick={() => setSpecs((current) => current.filter((_, row) => row !== index))}>برداشتن</button> : null}
          </div>
        ))}
        {canWrite && specs.length < 12 ? <button type="button" className={buttonGhost} onClick={() => setSpecs((current) => [...current, { label: "", value: "" }])}>ویژگی تازه</button> : null}
      </fieldset>
      <Field
        label="نشانی تصویر اصلی محصول"
        value={imageUrl}
        onChange={setImageUrl}
        disabled={!canWrite}
        ltr
        hint="لینک مستقیم تصویر همین محصول را وارد کنید، نه لوگوی سربرگ یا صفحه اصلی. نشانی باید HTTPS باشد؛ پیش‌نمایش زیر نتیجه را نشان می‌دهد."
      />
      {imageUrl ? <img src={imageUrl} alt="" className="h-24 w-24 rounded-2xl border border-line bg-cream object-contain" /> : null}
      {product ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-forest">کتابخانه رسانه</p>
          {catalog.media.length === 0 ? <p className="text-sm text-muted">هنوز تصویری در کتابخانه نیست. در میز محتوا فقط می‌توان نشانی HTTPS تصویر را به همراه متن جایگزین ثبت کرد.</p> : null}
          <input value={mediaQuery} onChange={(event) => setMediaQuery(event.target.value)} className={fieldClass} aria-label="جست‌وجوی رسانه" placeholder="جست‌وجو در نام یا نشانی تصویر" />
          {catalog.media.length === 100 ? <p className="text-xs text-muted">فقط ۱۰۰ رسانه تازه‌تر در این انتخاب‌گر بارگذاری شده‌اند.</p> : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {catalog.media.filter((media) => `${media.alt} ${media.publicUrl}`.toLowerCase().includes(mediaQuery.trim().toLowerCase())).map((media) => (
              <li key={media.id} className="flex items-center gap-2 rounded-2xl border border-line p-2">
                <img src={media.publicUrl} alt="" className="h-14 w-14 rounded-xl border border-line object-contain" />
                <span className="min-w-0 flex-1 truncate text-xs">{media.alt || media.id}</span>
                {canWrite ? (
                  <span className="flex flex-col gap-1">
                    <button type="button" className={buttonGhost} onClick={() => void linkMedia(media.id, media.publicUrl, true)}>
                      اصلی
                    </button>
                    <button type="button" className={buttonGhost} onClick={() => void linkMedia(media.id, media.publicUrl, false)}>
                      گالری
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-sm font-bold text-forest">تصاویر این محصول</p>
          {product.gallery.length === 0 ? <p className="text-sm text-muted">تصویری وصل نشده است.</p> : null}
          <ul className="flex flex-wrap gap-2">
            {product.gallery.map((image, index) => (
              <li key={image.id} className="rounded-2xl border border-line p-2 text-xs">
                <img src={image.url} alt="" className="h-16 w-16 rounded-xl object-contain" />
                <span className="mt-1 block">{image.isPrimary ? "اصلی" : "گالری"}</span>
                {canWrite && image.mediaId && !image.isPrimary ? (
                  <button type="button" className={buttonGhost} onClick={() => void linkMedia(image.mediaId!, image.url, true)}>اصلی کردن</button>
                ) : null}
                {canWrite ? (
                  <span className="mt-1 flex gap-1">
                    <button type="button" className={buttonGhost} disabled={galleryPending || index === 0} aria-label="انتقال تصویر به قبل" onClick={() => void moveGallery(index, -1)}>بالا</button>
                    <button type="button" className={buttonGhost} disabled={galleryPending || index === product.gallery.length - 1} aria-label="انتقال تصویر به بعد" onClick={() => void moveGallery(index, 1)}>پایین</button>
                  </span>
                ) : null}
                {canWrite && !image.isPrimary ? (
                  <button type="button" className={buttonGhost} onClick={() => void unlink(image.id)}>
                    برداشتن
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">بعد از اولین ذخیره، تصویر را از کتابخانه انتخاب کنید.</p>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <Check label="طبیعی" checked={isOrganic} disabled={!canWrite} onChange={setIsOrganic} />
        <Check label="پرفروش" checked={isBestSeller} disabled={!canWrite} onChange={setIsBestSeller} />
        <Check label="ویژه صفحه اصلی" checked={isFeatured} disabled={!canWrite} onChange={setIsFeatured} />
      </div>
      <div className="space-y-3">
        <p className="text-sm text-muted">بسته ذخیره‌شده حذف نمی‌شود تا سفارش‌های قبلی معتبر بمانند. آن را غیرفعال کنید. بسته تازه را پیش از ذخیره می‌توان برداشت.</p>
        {variants.map((variant, index) => (
          <VariantFields
            key={variant.id ?? `new-${index}`}
            variant={variant}
            canWrite={canWrite}
            canInventory={canInventory}
            onChange={(next) => patch(index, next)}
            onDefault={() => setVariants((current) => current.map((item, itemIndex) => ({ ...item, isDefault: itemIndex === index })))}
            onRemove={
              variant.id
                ? undefined
                : () => setVariants((current) => (current.length < 2 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
            }
            onMessage={setMessage}
            onAdjusted={() => void onSaved("")}
          />
        ))}
      </div>
      {canWrite && variants.length < 8 ? (
        <button
          type="button"
          className={buttonGhost}
          onClick={() =>
            setVariants((current) => [
              ...current,
              {
                sku: "",
                label: "",
                unitKind: "weight",
                amount: "100",
                priceToman: "",
                compareAtToman: "",
                isDefault: false,
                status: "active",
                openingOnHand: "0",
                onHand: 0,
                reserved: 0,
              },
            ])
          }
        >
          بسته تازه
        </button>
      ) : null}
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      {canWrite ? (
        <button type="button" className={buttonPrimary} disabled={pending} onClick={() => void save()}>
          {pending ? "در حال ذخیره" : "ذخیره محصول"}
        </button>
      ) : (
        <p className="text-sm text-muted">این نقش فقط مشاهده کاتالوگ را دارد.</p>
      )}
    </div>
  );
}

function VariantFields({
  variant,
  canWrite,
  canInventory,
  onChange,
  onDefault,
  onRemove,
  onMessage,
  onAdjusted,
}: {
  variant: DraftVariant;
  canWrite: boolean;
  canInventory: boolean;
  onChange: (patch: Partial<DraftVariant>) => void;
  onDefault: () => void;
  onRemove?: () => void;
  onMessage: (message: string) => void;
  onAdjusted: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام بسته" value={variant.label} disabled={!canWrite} required onChange={(value) => onChange({ label: value })} hint="مثلاً بطری ۲۵۰ میلی‌لیتری یا بسته ۵۰۰ گرمی." />
        <Field label="کد بسته (SKU)" value={variant.sku} disabled={!canWrite} ltr required onChange={(value) => onChange({ sku: value })} hint="برای هر بسته باید یکتا باشد؛ نمونه: OLIVE-OIL-250." />
        <label className="text-sm font-bold text-forest">
          نوع
          <select
            value={variant.unitKind}
            disabled={!canWrite}
            className={`${fieldClass} mt-2`}
            onChange={(event) => onChange({ unitKind: event.target.value as DraftVariant["unitKind"] })}
          >
            <option value="volume">حجم، میلی‌لیتر</option>
            <option value="weight">وزن، گرم</option>
            <option value="custom">سفارشی</option>
          </select>
        </label>
        <Field label="مقدار" value={variant.amount} disabled={!canWrite || variant.unitKind === "custom"} ltr required={variant.unitKind !== "custom"} onChange={(value) => onChange({ amount: value })} hint={variant.unitKind === "volume" ? "حجم را بر حسب میلی‌لیتر وارد کنید." : variant.unitKind === "weight" ? "وزن را بر حسب گرم وارد کنید." : "برای بسته سفارشی مقدار لازم نیست."} />
        <Field label="قیمت فروش (تومان)" value={variant.priceToman} disabled={!canWrite} ltr required onChange={(value) => onChange({ priceToman: value })} hint="قیمت نهایی قابل پرداخت، فقط عدد صحیح؛ ارقام فارسی و انگلیسی پذیرفته می‌شوند." />
        <Field label="قیمت قبل از تخفیف (تومان)" value={variant.compareAtToman} disabled={!canWrite} ltr onChange={(value) => onChange({ compareAtToman: value })} hint="اختیاری؛ فقط وقتی پر شود که از قیمت فروش بیشتر باشد." />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="radio" checked={variant.isDefault} disabled={!canWrite} onChange={onDefault} />
          بسته پیش‌فرض
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={variant.status === "active"}
            disabled={!canWrite}
            onChange={(event) => onChange({ status: event.target.checked ? "active" : "inactive" })}
          />
          فعال
        </label>
        {onRemove ? (
          <button type="button" className={buttonGhost} onClick={onRemove}>
            برداشتن بسته تازه
          </button>
        ) : null}
        {variant.id ? (
          <span className="text-muted">
            موجودی {toPersianNum(variant.onHand)} · رزرو {toPersianNum(variant.reserved)}
          </span>
        ) : (
          <Field
            label="موجودی اولیه"
            value={variant.openingOnHand}
            disabled={!canWrite || !canInventory}
            ltr
            onChange={(value) => onChange({ openingOnHand: value })}
          />
        )}
      </div>
      {variant.id && canInventory ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = parseWhole(delta);
            if (amount === null || !variant.id) {
              onMessage("مقدار اصلاح موجودی را عددی بنویسید.");
              return;
            }
            void adjustInventoryFn({ data: { variantId: variant.id, delta: amount, note } }).then((result) => {
              if (!result.ok) {
                onMessage(result.message);
                return;
              }
              setDelta("");
              setNote("");
              onMessage("");
              onChange({ onHand: variant.onHand + amount });
              onAdjusted();
            });
          }}
        >
          <input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="+/-" dir="ltr" className={`${fieldClass} text-left`} />
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="دلیل اصلاح" className={fieldClass} />
          <button type="submit" className={buttonGhost}>
            ثبت موجودی
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  ltr = false,
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ltr?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-bold text-forest">
      {label}{required ? " *" : ""}
      <input required={required} value={value} disabled={disabled} dir={ltr ? "ltr" : undefined} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} mt-2 ${ltr ? "text-left" : ""}`} />
      {hint ? <span className="mt-1 block text-xs font-normal leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 font-bold text-forest">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function getCatalogActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\\u0600-\\u06FF]/.test(error.message) && error.message.length <= 240) {
    return error.message;
  }
  return fallback;
}

function toDraft(variant: AdminVariant): DraftVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    label: variant.label,
    unitKind: variant.unitKind === "weight" || variant.unitKind === "custom" ? variant.unitKind : "volume",
    amount: variant.amount === null ? "" : String(variant.amount),
    priceToman: String(variant.priceToman),
    compareAtToman: variant.compareAtToman === null ? "" : String(variant.compareAtToman),
    isDefault: variant.isDefault,
    status: variant.status === "inactive" ? "inactive" : "active",
    openingOnHand: "0",
    onHand: variant.onHand,
    reserved: variant.reserved,
  };
}
