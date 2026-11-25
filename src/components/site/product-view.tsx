import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { isShopImage } from "@/lib/media-bytes";
import { useWishlist } from "@/lib/cart-store";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import type { ProductDetail } from "@/lib/store-types";
import { addCartItemFn } from "@/server/commerce/api";
import { wishlistSync } from "./wishlist-client";
import { beginCartWrite, clearCartAdd, getCartIntents, notifyCart, startCartAdd } from "./cart-client";
import { useCartIntents } from "./use-cart-intents";
import { ProductMark } from "./product-mark";
import { buttonGhost, buttonGold, buttonPrimary, pageKicker, panelClass } from "./ui";

export function ProductView({ product, initialSku }: { product: ProductDetail; initialSku?: string }) {
  const initial = product.variants.find((item) => item.sku === initialSku) ?? product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const [variantId, setVariantId] = useState(initial?.id ?? "");
  const [imageId, setImageId] = useState(product.gallery.find((image) => image.isPrimary)?.id ?? product.gallery[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const intents = useCartIntents();
  const wished = useWishlist((state) => state.ids.includes(product.id));
  const [wishPending, setWishPending] = useState(false);
  const [wishNote, setWishNote] = useState("");

  // Align the browser copy with the current session. The sync controller drops this read if the
  // customer pressed the heart (or anything else changed the list) while it was in flight.
  useEffect(() => {
    void wishlistSync.load();
  }, []);

  function toggleWishlist() {
    if (wishPending) return;
    setWishPending(true);
    setWishNote("");
    void wishlistSync.toggle(product.id)
      .then((result) => {
        if (result.notice) setWishNote(result.notice);
      })
      .finally(() => setWishPending(false));
  }
  const variant = product.variants.find((item) => item.id === variantId) ?? initial;
  const activeImage = product.gallery.find((image) => image.id === imageId) ?? product.gallery.find((image) => image.isPrimary) ?? product.gallery[0];
  if (!variant) return null;
  const discounted = variant.compareAtPriceIrr !== null && variant.compareAtPriceIrr > variant.priceIrr;

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-8 lg:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border border-gold/40 bg-paper">
        {isShopImage(activeImage?.url ?? product.imageUrl) ? (
          <img src={activeImage?.url ?? product.imageUrl} alt={activeImage?.alt || product.name} className="aspect-square w-full object-cover" />
        ) : (
          <ProductMark iconType={product.iconType} title={product.name} subtitle={variant.label} />
        )}
        {product.gallery.length > 1 ? (
          <div className="flex flex-wrap gap-2 border-t border-line p-3" aria-label="تصاویر محصول">
            {product.gallery.map((image, index) => (
              isShopImage(image.url) ? (
                <button
                  key={image.id}
                  type="button"
                  className={`rounded-xl border p-1 ${image.id === (activeImage?.id ?? "") ? "border-forest" : "border-line"}`}
                  aria-label={`نمایش تصویر ${index + 1} از ${product.gallery.length}`}
                  aria-pressed={image.id === (activeImage?.id ?? "")}
                  onClick={() => setImageId(image.id)}
                >
                  <img src={image.url} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
                </button>
              ) : null
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <p className={pageKicker}>
          <a href={`/products?category=${product.categorySlug}`} className="hover:underline">
            {product.categoryName}
          </a>
        </p>
        <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">{product.name}</h1>
        <p className="mt-1 font-display text-xs text-muted">{product.englishName}</p>
        {product.shortDescription.trim() ? <p className="mt-4 text-sm leading-8">{product.shortDescription}</p> : null}
        <div className={`${panelClass} mt-6 p-5`}>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === variant.id}
              onClick={() => {
                setVariantId(item.id);
                setNote("");
              }}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ${item.id === variant.id ? "bg-forest text-ivory" : "border border-line bg-ivory"}`}
            >
              {item.label}
          </button>
        ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          کد بسته: <span dir="ltr">{variant.sku}</span>
          {variant.amount !== null && variant.unitKind !== "custom" ? ` · ${toPersianNum(variant.amount)} ${variant.unitKind === "volume" ? "میلی‌لیتر" : "گرم"}` : ""}
        </p>
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-2xl font-bold tabular-nums text-forest">{formatTomanFromIrr(variant.priceIrr)}</p>
          {variant.amount && variant.amount > 0 && variant.unitKind !== "custom" ? (
            <p className="text-xs text-muted">هر ۱۰۰ {variant.unitKind === "volume" ? "میلی‌لیتر" : "گرم"}: {formatTomanFromIrr(Math.round(variant.priceIrr * 100 / variant.amount))}</p>
          ) : null}
          {discounted && variant.compareAtPriceIrr ? (
            <p className="text-sm text-muted line-through tabular-nums">{formatTomanFromIrr(variant.compareAtPriceIrr)}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            {variant.onHand > 0 ? `${toPersianNum(variant.onHand)} عدد موجود` : "این بسته ناموجود است"}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            تعداد
            <input
              type="number"
              min={1}
              max={Math.max(1, Math.min(20, variant.onHand))}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value) || 1)}
              className="h-11 w-20 rounded-xl border border-line bg-paper px-3"
            />
          </label>
          <button
            type="button"
            disabled={variant.onHand < 1 || pending || !intents || !intents.storageAvailable || !!intents.retry || intents.retryInvalid || intents.addPending}
            className={buttonPrimary}
            onClick={() => {
              const current = getCartIntents();
              if (!current.storageAvailable || current.retry || current.retryInvalid || current.addPending) {
                setNote("ابتدا وضعیت ذخیره‌سازی و تغییر تأییدنشده را در سبد خرید بررسی کنید.");
                return;
              }
              const release = beginCartWrite();
              if (!release) {
                setNote("تغییر دیگری در سبد در حال انجام است؛ کمی بعد دوباره تلاش کنید.");
                return;
              }
              if (!startCartAdd()) {
                release();
                setNote("ذخیره هشدار افزودن ممکن نشد؛ درخواستی ارسال نشد. تنظیمات ذخیره‌سازی مرورگر را بررسی کنید.");
                return;
              }
              setPending(true);
              setNote("");
              const requested = Math.max(1, Math.min(20, variant.onHand, Math.floor(quantity) || 1));
              setQuantity(requested);
              void Promise.resolve().then(() => addCartItemFn({ data: { variantId: variant.id, quantity: requested } }))
                .then((result) => {
                  if (result.ok) clearCartAdd();
                  notifyCart(result.cart.count);
                  setNote(result.message ?? (result.ok ? "به سبد اضافه شد." : "افزودن انجام نشد."));
                })
                .catch(() => setNote("نتیجه افزودن مشخص نشد و ممکن است ثبت شده باشد؛ پیش از تلاش دوباره سبد را بررسی کنید."))
                .finally(() => { release(); setPending(false); });
            }}
          >
            {pending ? "در حال افزودن" : "افزودن به سبد"}
          </button>
          <button
            type="button"
            className={`${wished ? `${buttonGhost} hover:border-gold hover:bg-cream` : buttonGold} transition-colors active:border-gold active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60`}
            disabled={wishPending}
            aria-pressed={wished}
            onClick={toggleWishlist}
          >
            {wishPending ? "در حال ذخیره" : wished ? "در علاقه‌مندی‌ها" : "علاقه‌مندی"}
          </button>
        </div>
        {wishNote ? (
          <p className="mt-3 text-sm font-bold text-forest" role="alert">
            {wishNote}
          </p>
        ) : null}
        {note ? (
          <p className="mt-3 text-sm font-bold text-forest" role="status">
            {note}
          </p>
        ) : null}
        {intents && (!intents.storageAvailable || intents.retry || intents.retryInvalid || intents.addPending) ? (
          <p role="alert" className="mt-3 text-sm leading-7 text-forest">
            {!intents.storageAvailable ? "ذخیره‌سازی نشست مرورگر در دسترس نیست؛ افزودن برای جلوگیری از ثبت تکراری غیرفعال است. " : intents.addPending ? "نتیجه افزودن قبلی ممکن است ثبت شده باشد. ابتدا سبد تازه را بررسی و تأیید کنید. " : "یک تغییر سبد در انتظار بررسی است. "}
            <Link to="/cart" className="font-bold underline">بررسی سبد خرید</Link>
          </p>
        ) : null}
        </div>
        <dl className="mt-8 space-y-4 text-sm leading-7">
          <Block title="معرفی" text={product.fullDescription} />
          <Block title="منشأ" text={product.origin} />
          <Block title="ترکیبات" text={product.ingredients} />
          <Block title="روش مصرف" text={product.usageInstructions} />
          <Block title="نگهداری" text={product.storageInstructions} />
        </dl>
        {product.specs.length ? (
          <div className="mt-6 overflow-hidden rounded-3xl border border-line">
            {product.specs.map((spec) => (
              <div key={spec.label} className="grid gap-1 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:grid-cols-2 sm:gap-3">
                <dt className="font-bold text-forest">{spec.label}</dt>
                <dd>{spec.text}</dd>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <dt className="font-bold text-forest">{title}</dt>
      <dd className="whitespace-pre-line">{text}</dd>
    </div>
  );
}
