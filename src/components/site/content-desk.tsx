import { useEffect, useState } from "react";
import { parseWhole } from "@/lib/catalog-rules";
import { FLAG_LABELS, PRODUCT_FLAGS, SECTION_LABELS, isProductSection, isPublicHomeSection, isSectionType } from "@/lib/cms-rules";
import type { CmsArticle, CmsBanner, CmsDesk, CmsMenu, CmsPage, CmsResult, CmsSection, SectionFlag } from "@/lib/cms-types";
import {
  getCmsDesk,
  registerMediaFn,
  retireArticleFn,
  retireMediaFn,
  saveArticleFn,
  saveBannerFn,
  saveBannerOrderFn,
  saveNavFn,
  saveNavOrderFn,
  savePageFn,
  saveSectionFn,
  saveSectionOrderFn,
  saveSiteCopyFn,
  saveStoreProfileFn,
} from "@/server/cms/api";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";

type Tab = "home" | "nav" | "pages" | "magazine" | "media";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "home", label: "صفحه اول" },
  { id: "nav", label: "منو" },
  { id: "pages", label: "صفحه‌ها" },
  { id: "magazine", label: "مجله" },
  { id: "media", label: "رسانه" },
];

export function ContentDesk() {
  const [desk, setDesk] = useState<CmsDesk | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [stamp, setStamp] = useState(0);

  async function reload() {
    const next = await getCmsDesk();
    setDesk(next);
    setStamp((value) => value + 1);
  }

  useEffect(() => {
    void reload().catch(() => setNotice("محتوا خوانده نشد."));
  }, []);

  async function finish(result: CmsResult) {
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice("ذخیره شد.");
    await reload();
  }

  async function move(kind: "section" | "banner" | "nav", ids: string[], index: number, delta: number, menuKey?: string) {
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    const result =
      kind === "section"
        ? await saveSectionOrderFn({ data: { ids: next } })
        : kind === "banner"
          ? await saveBannerOrderFn({ data: { ids: next } })
          : await saveNavOrderFn({ data: { menuKey: menuKey ?? "", ids: next } });
    await finish(result);
  }

  return (
    <div className="mt-6">
      <p className="text-sm leading-7 text-muted">
        ترتیب با دکمه‌ها عوض می‌شود. لوگوی رسمی هدر و هیرو ثابت است. در این نسخه تصویر فقط با ثبت نشانی عمومی HTTPS و متن جایگزین به کتابخانه افزوده می‌شود؛ بارگذاری فایل و فضای ابری در دسترس نیست.
      </p>
      {notice ? (
        <p className="mt-3 text-sm font-bold text-forest" role="status">
          {notice}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? buttonPrimary : buttonGhost} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {!desk ? <p className="mt-4 text-sm">در حال خواندن...</p> : null}
      {desk ? (
        <div key={stamp} className="mt-6 space-y-4">
          {tab === "home" ? <HomeTab desk={desk} onDone={finish} onMove={move} /> : null}
          {tab === "nav" ? <NavTab desk={desk} onDone={finish} onMove={move} /> : null}
          {tab === "pages" ? <PagesTab desk={desk} onDone={finish} /> : null}
          {tab === "magazine" ? <MagazineTab desk={desk} onDone={finish} /> : null}
          {tab === "media" ? <MediaTab desk={desk} onDone={finish} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function HomeTab({
  desk,
  onDone,
  onMove,
}: {
  desk: CmsDesk;
  onDone: (result: CmsResult) => Promise<void>;
  onMove: (kind: "section" | "banner", ids: string[], index: number, delta: number) => Promise<void>;
}) {
  return (
    <>
      <CopyForm desk={desk} onDone={onDone} />
      <ProfileForm desk={desk} onDone={onDone} />
      <p className="text-sm leading-7 text-muted">پس از به‌روزرسانی، عنوان و زیرعنوان سه بخش محصولات را بررسی کنید. متن‌هایی که قبلاً در مدیریت ویرایش شده‌اند خودکار جایگزین نمی‌شوند.</p>
      {desk.sections.length === 0 ? <p className="text-sm leading-7 text-muted">هنوز بخشی در پایگاه داده وجود ندارد؛ این صفحه فقط بخش‌های موجود را ویرایش می‌کند.</p> : null}
      {desk.sections.map((section, index) => (
        <SectionForm
          key={section.id}
          section={section}
          canUp={index > 0}
          canDown={index < desk.sections.length - 1}
          onUp={() => void onMove("section", desk.sections.map((row) => row.id), index, -1)}
          onDown={() => void onMove("section", desk.sections.map((row) => row.id), index, 1)}
          onDone={onDone}
        />
      ))}
      <p className="text-sm leading-7 text-muted">خطوط اسلایدر در گروه‌های سه‌تایی نمایش داده می‌شوند؛ همه بنرهای فعال به ترتیب و با دکمه‌های قبلی و بعدی قابل دیدن‌اند.</p>
      {desk.banners.map((banner, index) => (
        <BannerForm
          key={banner.id}
          banner={banner}
          canUp={index > 0}
          canDown={index < desk.banners.length - 1}
          onUp={() => void onMove("banner", desk.banners.map((row) => row.id), index, -1)}
          onDown={() => void onMove("banner", desk.banners.map((row) => row.id), index, 1)}
          media={desk.media}
          onDone={onDone}
        />
      ))}
      <BannerForm banner={null} media={desk.media} canUp={false} canDown={false} onUp={() => undefined} onDown={() => undefined} onDone={onDone} />
    </>
  );
}

function CopyForm({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [storyTitle, setStoryTitle] = useState(desk.storyTitle);
  const [storyAbout, setStoryAbout] = useState(desk.storyAbout);
  const [storyPhilosophy, setStoryPhilosophy] = useState(desk.storyPhilosophy);
  const [promo, setPromo] = useState(desk.promo);
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void saveSiteCopyFn({ data: { storyTitle, storyAbout, storyPhilosophy, promo } })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <h2 className="font-bold text-forest">معرفی و نوار بالا</h2>
      <input className={fieldClass} value={storyTitle} onChange={(event) => setStoryTitle(event.target.value)} aria-label="عنوان معرفی" />
      <textarea className={`${fieldClass} min-h-28`} value={storyAbout} onChange={(event) => setStoryAbout(event.target.value)} aria-label="متن معرفی" />
      <textarea className={`${fieldClass} min-h-24`} value={storyPhilosophy} onChange={(event) => setStoryPhilosophy(event.target.value)} aria-label="فلسفه" />
      <input className={fieldClass} value={promo} onChange={(event) => setPromo(event.target.value)} aria-label="نوار بالای سایت" />
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره معرفی
      </button>
    </form>
  );
}

function ProfileForm({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [phone, setPhone] = useState(desk.phone);
  const [whatsapp, setWhatsapp] = useState(desk.whatsapp);
  const [email, setEmail] = useState(desk.email);
  const [address, setAddress] = useState(desk.address);
  const [instagram, setInstagram] = useState(desk.instagram);
  const [telegram, setTelegram] = useState(desk.telegram);
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void saveStoreProfileFn({ data: { phone, whatsapp, email, address, instagram, telegram } })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <h2 className="font-bold text-forest">راه‌های تماس</h2>
      <p className="text-xs leading-6 text-muted">خالی بماند تا وقتی شماره، نشانی یا شبکه واقعی را خودتان وارد کنید. مقدار نمونه منتشر نمی‌شود.</p>
      <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} aria-label="تلفن" placeholder="تلفن" />
      <input className={fieldClass} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} aria-label="واتساپ" placeholder="واتساپ" />
      <input className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} aria-label="ایمیل" placeholder="ایمیل" dir="ltr" />
      <textarea className={`${fieldClass} min-h-20`} value={address} onChange={(event) => setAddress(event.target.value)} aria-label="نشانی" placeholder="نشانی" />
      <input className={fieldClass} value={instagram} onChange={(event) => setInstagram(event.target.value)} aria-label="اینستاگرام" placeholder="اینستاگرام" dir="ltr" />
      <input className={fieldClass} value={telegram} onChange={(event) => setTelegram(event.target.value)} aria-label="تلگرام" placeholder="تلگرام" dir="ltr" />
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره تماس
      </button>
    </form>
  );
}

function SectionForm({
  section,
  canUp,
  canDown,
  onUp,
  onDown,
  onDone,
}: {
  section: CmsSection;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDone: (result: CmsResult) => Promise<void>;
}) {
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  const [body, setBody] = useState(section.body);
  const [isActive, setIsActive] = useState(section.isActive);
  const [limit, setLimit] = useState(String(section.config.limit ?? 4));
  const [flags, setFlags] = useState<SectionFlag[]>(section.config.flags ?? []);
  const [items, setItems] = useState(section.config.items ?? [{ title: "", text: "" }]);
  const [message, setMessage] = useState("");
  const product = isProductSection(section.sectionType);
  const label = isSectionType(section.sectionType) ? SECTION_LABELS[section.sectionType] : section.sectionType;

  function toggleFlag(flag: SectionFlag) {
    setFlags((current) => (current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag]));
  }

  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        const parsedLimit = parseWhole(limit);
        if (product && (parsedLimit === null || parsedLimit < 1 || parsedLimit > 12)) {
          setMessage("تعداد نمایش باید عدد ۱ تا ۱۲ باشد.");
          return;
        }
        void saveSectionFn({
          data: {
            id: section.id,
            title,
            subtitle,
            body,
            isActive,
            config: product ? { limit: parsedLimit ?? 4, flags } : section.sectionType === "brand_benefits" ? { items } : {},
          },
        })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-forest">{label}</h2>
        <button type="button" className={buttonGhost} disabled={!canUp} onClick={onUp}>
          بالاتر
        </button>
        <button type="button" className={buttonGhost} disabled={!canDown} onClick={onDown}>
          پایین‌تر
        </button>
      </div>
      {!isPublicHomeSection(section) ? <p className="text-sm leading-7 text-muted">این بخش در صفحه اول نمایش داده نمی‌شود؛ اطلاعات و ترتیب آن در مدیریت حفظ شده است.</p> : null}
      <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان بخش" />
      <input className={fieldClass} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} aria-label="زیرعنوان بخش" />
      <textarea className={`${fieldClass} min-h-24`} value={body} onChange={(event) => setBody(event.target.value)} aria-label="متن بخش" />
      {section.sectionType === "brand_benefits"
        ? items.map((item, index) => (
            <div key={`${section.id}-item-${index}`} className="grid gap-2 sm:grid-cols-2">
              <input
                className={fieldClass}
                value={item.title}
                aria-label="عنوان تعهد"
                onChange={(event) => setItems((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, title: event.target.value } : row)))}
              />
              <input
                className={fieldClass}
                value={item.text}
                aria-label="متن تعهد"
                onChange={(event) => setItems((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, text: event.target.value } : row)))}
              />
            </div>
          ))
        : null}
      {section.sectionType === "brand_benefits" ? (
        <button
          type="button"
          className={buttonGhost}
          onClick={() => setItems((current) => (current.length >= 6 ? current : [...current, { title: "", text: "" }]))}
        >
          تعهد تازه
        </button>
      ) : null}
      {product ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <input className={`${fieldClass} max-w-24`} value={limit} onChange={(event) => setLimit(event.target.value)} aria-label="تعداد نمایش" inputMode="numeric" />
          {PRODUCT_FLAGS.map((flag) => (
            <label key={flag} className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
              {FLAG_LABELS[flag]}
            </label>
          ))}
        </div>
      ) : null}
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        فعال
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره بخش
      </button>
    </form>
  );
}

function BannerForm({
  banner,
  media,
  canUp,
  canDown,
  onUp,
  onDown,
  onDone,
}: {
  banner: CmsBanner | null;
  media: CmsDesk["media"];
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDone: (result: CmsResult) => Promise<void>;
}) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [body, setBody] = useState(banner?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(banner?.ctaHref ?? "/products");
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [startsOn, setStartsOn] = useState(banner?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(banner?.endsOn ?? "");
  const [desktopMediaId, setDesktopMediaId] = useState(banner?.desktopMediaId ?? "");
  const [mobileMediaId, setMobileMediaId] = useState(banner?.mobileMediaId ?? "");
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void saveBannerFn({
          data: {
            id: banner?.id,
            title,
            subtitle,
            body,
            ctaLabel,
            ctaHref,
            isActive,
            startsOn,
            endsOn,
            desktopMediaId: desktopMediaId || null,
            mobileMediaId: mobileMediaId || null,
          },
        })
          .then(async (result) => {
            if (result.ok && !banner) {
              setTitle("");
              setSubtitle("");
              setBody("");
              setCtaLabel("");
              setCtaHref("/products");
              setIsActive(true);
              setStartsOn("");
              setEndsOn("");
              setDesktopMediaId("");
              setMobileMediaId("");
            }
            await onDone(result);
          })
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-forest">{banner ? "اسلاید" : "اسلاید تازه"}</h2>
        {banner ? (
          <>
            <button type="button" className={buttonGhost} disabled={!canUp} onClick={onUp}>
              بالاتر
            </button>
            <button type="button" className={buttonGhost} disabled={!canDown} onClick={onDown}>
              پایین‌تر
            </button>
          </>
        ) : null}
      </div>
      <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان اسلاید" />
      <input className={fieldClass} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} aria-label="زیرعنوان اسلاید" />
      <textarea className={`${fieldClass} min-h-24`} value={body} onChange={(event) => setBody(event.target.value)} aria-label="متن اسلاید" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} aria-label="متن دکمه" />
        <input className={fieldClass} value={ctaHref} onChange={(event) => setCtaHref(event.target.value)} aria-label="نشانی دکمه" dir="ltr" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} aria-label="شروع نمایش" />
        <input className={fieldClass} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} aria-label="پایان نمایش" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MediaChoice label="تصویر دسکتاپ" value={desktopMediaId} media={media} onChange={setDesktopMediaId} />
        <MediaChoice label="تصویر موبایل" value={mobileMediaId} media={media} onChange={setMobileMediaId} />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        فعال
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره اسلاید
      </button>
    </form>
  );
}

function MediaChoice({
  label,
  value,
  media,
  onChange,
}: {
  label: string;
  value: string;
  media: CmsDesk["media"];
  onChange: (id: string) => void;
}) {
  const selected = media.find((item) => item.id === value);
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-forest">
        {label}
        <select className={`${fieldClass} mt-2`} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
          <option value="">بدون تصویر</option>
          {media.map((item) => (
            <option key={item.id} value={item.id}>
              {item.alt || item.filename}
            </option>
          ))}
        </select>
      </label>
      {selected ? <MediaThumb src={selected.publicUrl} className="h-20 w-full rounded-2xl border border-line bg-cream object-contain" /> : null}
      {value && !selected ? <p className="text-xs text-muted">این تصویر دیگر در کتابخانه نیست.</p> : null}
    </div>
  );
}

function NavTab({
  desk,
  onDone,
  onMove,
}: {
  desk: CmsDesk;
  onDone: (result: CmsResult) => Promise<void>;
  onMove: (kind: "nav", ids: string[], index: number, delta: number, menuKey?: string) => Promise<void>;
}) {
  return (
    <>
      {desk.menus.map((menu) => (
        <section key={menu.key} className="space-y-3">
          <h2 className="font-bold text-forest">{menu.name}</h2>
          {menu.items.map((item, index) => (
            <NavForm
              key={item.id}
              menu={menu}
              item={item}
              canUp={index > 0}
              canDown={index < menu.items.length - 1}
              onUp={() => void onMove("nav", menu.items.map((row) => row.id), index, -1, menu.key)}
              onDown={() => void onMove("nav", menu.items.map((row) => row.id), index, 1, menu.key)}
              onDone={onDone}
            />
          ))}
          <NavForm menu={menu} item={null} canUp={false} canDown={false} onUp={() => undefined} onDown={() => undefined} onDone={onDone} />
        </section>
      ))}
    </>
  );
}

function NavForm({
  menu,
  item,
  canUp,
  canDown,
  onUp,
  onDown,
  onDone,
}: {
  menu: CmsMenu;
  item: CmsMenu["items"][number] | null;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDone: (result: CmsResult) => Promise<void>;
}) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [href, setHref] = useState(item?.href ?? "/");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void saveNavFn({ data: { id: item?.id, menuKey: menu.key, label, href, isActive } })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <div className="flex flex-wrap gap-2">
        {item ? (
          <>
            <button type="button" className={buttonGhost} disabled={!canUp} onClick={onUp}>
              بالاتر
            </button>
            <button type="button" className={buttonGhost} disabled={!canDown} onClick={onDown}>
              پایین‌تر
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">پیوند تازه</p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={label} onChange={(event) => setLabel(event.target.value)} aria-label="برچسب پیوند" />
        <input className={fieldClass} value={href} onChange={(event) => setHref(event.target.value)} aria-label="نشانی پیوند" dir="ltr" />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        فعال
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره پیوند
      </button>
    </form>
  );
}

function PagesTab({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [pageId, setPageId] = useState(desk.pages[0]?.id ?? "");
  const page = desk.pages.find((item) => item.id === pageId) ?? null;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-7 text-muted">نامک صفحه‌های متصل به مسیرهای فعلی تغییر نمی‌کند. صفحه تازه با مسیر /pages/{"{slug}"} ساخته می‌شود؛ صفحه منتشرنشده در سایت دیده نمی‌شود.</p>
      <button type="button" className={pageId === "new" ? buttonPrimary : buttonGhost} onClick={() => setPageId("new")}>صفحه تازه</button>
      <select className={fieldClass} value={pageId} onChange={(event) => setPageId(event.target.value)} aria-label="انتخاب صفحه">
        {desk.pages.length === 0 ? <option value="">صفحه‌ای ثبت نشده است</option> : null}
        {desk.pages.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      {pageId === "new" ? <PageForm key="new" page={null} onDone={onDone} /> : page ? <PageForm key={page.id} page={page} onDone={onDone} /> : null}
    </div>
  );
}

function PageForm({ page, onDone }: { page: CmsPage | null; onDone: (result: CmsResult) => Promise<void> }) {
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [seoTitle, setSeoTitle] = useState(page?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page?.seoDescription ?? "");
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? false);
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void savePageFn({ data: { id: page?.id, slug, title, body, seoTitle, seoDescription, isPublished } })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      {page ? (
        <p className="text-xs text-gold" dir="ltr">/{page.slug}</p>
      ) : (
        <label className="block text-sm font-bold text-forest">شناسه انگلیسی صفحه
          <input className={`${fieldClass} mt-2 text-left`} value={slug} onChange={(event) => setSlug(event.target.value)} aria-label="شناسه انگلیسی صفحه" dir="ltr" placeholder="about-us" />
          <span className="mt-1 block text-xs text-muted" dir="ltr">/pages/{slug || "slug"}</span>
        </label>
      )}
      <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان صفحه" />
      <p className="text-xs leading-6 text-muted">متن ساده و فارسی پذیرفته می‌شود؛ برای شروع بند تازه یک خط خالی بگذارید. HTML اجرا نمی‌شود.</p>
      <textarea className={`${fieldClass} min-h-40`} value={body} onChange={(event) => setBody(event.target.value)} aria-label="متن صفحه" />
      <input className={fieldClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} aria-label="عنوان سئو" />
      <input className={fieldClass} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} aria-label="شرح سئو" />
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
        منتشر شده
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره صفحه
      </button>
    </form>
  );
}

function MagazineTab({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [articleId, setArticleId] = useState<string>("new");
  const [query, setQuery] = useState("");
  const article = desk.articles.find((item) => item.id === articleId) ?? null;
  return (
    <div className="space-y-3">
      <input className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجوی مقاله" placeholder="جست‌وجو در عنوان یا نامک مقاله" />
      {desk.articles.length === 100 ? <p className="text-xs text-muted">فقط ۱۰۰ مقاله تازه‌تر بارگذاری شده‌اند.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={articleId === "new" ? buttonPrimary : buttonGhost} onClick={() => setArticleId("new")}>
          مقاله تازه
        </button>
        {desk.articles.filter((item) => `${item.title} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase())).map((item) => (
          <button key={item.id} type="button" className={articleId === item.id ? buttonPrimary : buttonGhost} onClick={() => setArticleId(item.id)}>
            {item.title}
          </button>
        ))}
      </div>
      <ArticleForm key={article?.id ?? "new"} desk={desk} article={article} onDone={onDone} />
    </div>
  );
}

function ArticleForm({ desk, article, onDone }: { desk: CmsDesk; article: CmsArticle | null; onDone: (result: CmsResult) => Promise<void> }) {
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [title, setTitle] = useState(article?.title ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [authorName, setAuthorName] = useState(article?.authorName ?? "کارگاه شاهو");
  const [readMinutes, setReadMinutes] = useState(String(article?.readMinutes ?? 3));
  const [status, setStatus] = useState<"draft" | "published">(article?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(article?.categoryId || desk.articleCategories[0]?.id || "");
  const [coverMediaId, setCoverMediaId] = useState(article?.coverMediaId ?? "");
  const [related, setRelated] = useState<string[]>(article?.relatedProductIds ?? []);
  const [message, setMessage] = useState("");
  const minutes = parseWhole(readMinutes);
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        if (minutes === null) {
          setMessage("زمان مطالعه را عددی بنویسید.");
          return;
        }
        void saveArticleFn({
          data: {
            id: article?.id,
            slug,
            title,
            excerpt,
            seoTitle,
            seoDescription,
            content,
            authorName,
            readMinutes: minutes,
            status,
            categoryId,
            coverMediaId: coverMediaId || null,
            relatedProductIds: related,
          },
        })
          .then(onDone)
          .catch(() => setMessage("ذخیره انجام نشد."));
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان مقاله" />
        <input className={fieldClass} value={slug} onChange={(event) => setSlug(event.target.value)} aria-label="نامک مقاله" dir="ltr" />
      </div>
      <textarea className={`${fieldClass} min-h-20`} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} aria-label="خلاصه" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} aria-label="عنوان سئو مقاله" placeholder="عنوان سئو؛ خالی = عنوان مقاله" maxLength={120} />
        <input className={fieldClass} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} aria-label="شرح سئو مقاله" placeholder="شرح سئو؛ خالی = خلاصه" maxLength={240} />
      </div>
      <p className="text-xs leading-6 text-muted">متن مقاله ساده و فارسی است؛ برای شروع بند تازه یک خط خالی بگذارید. HTML اجرا نمی‌شود.</p>
      <textarea className={`${fieldClass} min-h-40`} value={content} onChange={(event) => setContent(event.target.value)} aria-label="متن مقاله" />
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={fieldClass} value={authorName} onChange={(event) => setAuthorName(event.target.value)} aria-label="نویسنده" />
        <input className={fieldClass} value={readMinutes} onChange={(event) => setReadMinutes(event.target.value)} aria-label="دقیقه مطالعه" inputMode="numeric" />
        <select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="دسته مقاله">
          {desk.articleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value === "published" ? "published" : "draft")} aria-label="وضعیت مقاله">
        <option value="draft">پیش‌نویس</option>
        <option value="published">منتشر شده</option>
      </select>
      <select className={fieldClass} value={coverMediaId} onChange={(event) => setCoverMediaId(event.target.value)} aria-label="جلد">
        <option value="">بدون جلد</option>
        {desk.media.map((media) => (
          <option key={media.id} value={media.id}>
            {media.alt || media.filename}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-3 text-sm">
        {desk.products.map((product) => (
          <label key={product.id} className="inline-flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={related.includes(product.id)}
              onChange={() => setRelated((current) => (current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]))}
            />
            {product.name}
          </label>
        ))}
      </div>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonPrimary}>
          ذخیره مقاله
        </button>
        {article ? (
          <button
            type="button"
            className={buttonGhost}
            onClick={() => {
              void retireArticleFn({ data: { id: article.id } })
                .then(onDone)
                .catch(() => setMessage("حذف انجام نشد."));
            }}
          >
            برداشتن از مجله
          </button>
        ) : null}
      </div>
    </form>
  );
}

function MediaThumb({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (broken) {
    return (
      <span className={`${className} flex items-center justify-center text-[10px] text-muted`} role="img" aria-label="تصویر در دسترس نیست">
        بدون تصویر
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={className} />;
}

function MediaTab({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [retiring, setRetiring] = useState<string | null>(null);

  async function register() {
    if (registering) return;
    setRegistering(true);
    setMessage(null);
    try {
      const result = await registerMediaFn({ data: { url, alt } });
      if (result.ok) {
        setUrl("");
        setAlt("");
      }
      await onDone(result);
    } catch {
      setMessage({ text: "ثبت انجام نشد. دوباره تلاش کنید.", error: true });
    } finally {
      setRegistering(false);
    }
  }

  async function retire(id: string) {
    if (retiring) return;
    setRetiring(id);
    setMessage(null);
    try {
      const result = await retireMediaFn({ data: { id } });
      await onDone(result);
    } catch {
      setMessage({ text: "کنار گذاشتن تصویر انجام نشد. دوباره تلاش کنید.", error: true });
    } finally {
      setRetiring(null);
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <p className="text-sm font-bold text-forest" role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
      <form
        className={`${panelClass} space-y-3 p-4`}
        onSubmit={(event) => {
          event.preventDefault();
          void register();
        }}
      >
        <h2 className="font-bold text-forest">ثبت نشانی تصویر HTTPS</h2>
        <input className={fieldClass} value={url} onChange={(event) => setUrl(event.target.value)} aria-label="نشانی تصویر" dir="ltr" placeholder="https://" />
        <input className={fieldClass} value={alt} onChange={(event) => setAlt(event.target.value)} aria-label="متن جایگزین" />
        <button type="submit" className={buttonPrimary} disabled={registering}>
          {registering ? "در حال ثبت..." : "ثبت نشانی"}
        </button>
      </form>
      <input className={fieldClass} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجوی رسانه" placeholder="جست‌وجو در نام، متن جایگزین یا نشانی" />
      {desk.media.length === 100 ? <p className="text-xs text-muted">فقط ۱۰۰ رسانه تازه‌تر بارگذاری شده‌اند.</p> : null}
      {desk.media.filter((media) => `${media.filename} ${media.alt} ${media.publicUrl}`.toLowerCase().includes(query.trim().toLowerCase())).map((media) => (
        <article key={media.id} className={`${panelClass} flex flex-wrap items-center gap-3 p-4`}>
          <MediaThumb src={media.publicUrl} className="h-16 w-16 rounded-2xl border border-line bg-cream object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-forest">{media.alt || media.filename}</p>
            <p className="truncate text-xs text-muted" dir="ltr">
              {media.publicUrl}
            </p>
          </div>
          {media.official ? (
            <p className="text-xs font-bold text-gold">فایل رسمی</p>
          ) : (
            <button type="button" className={buttonGhost} disabled={retiring !== null} onClick={() => void retire(media.id)}>
              {retiring === media.id ? "در حال انجام..." : "کنار گذاشتن"}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
