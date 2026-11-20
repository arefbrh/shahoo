import { useEffect, useState } from "react";
import { uploadMedia, validateUploadFile } from "@/lib/media-upload-client";
import { parseWhole } from "@/lib/catalog-rules";
import { FLAG_LABELS, PRODUCT_FLAGS, SECTION_LABELS, isProductSection, isPublicHomeSection, isSectionType } from "@/lib/cms-rules";
import type { CmsArticle, CmsBanner, CmsDesk, CmsMenu, CmsPage, CmsResult, CmsSection, SectionFlag } from "@/lib/cms-types";
import {
  getCmsDesk,
  getContentHistoryFn,
  registerMediaFn,
  retireArticleFn,
  restoreContentRevisionFn,
  retireMediaFn,
  saveArticleFn,
  saveBannerFn,
  saveBannerOrderFn,
  saveBrandSettingsFn,
  saveCarouselSettingsFn,
  saveStoreLayoutFn,
  saveNavFn,
  saveNavOrderFn,
  savePageFn,
  saveSectionFn,
  saveSectionOrderFn,
  saveSiteCopyFn,
  saveStoreProfileFn,
} from "@/server/cms/api";
import { buttonGhost, buttonPrimary, fieldClass, panelClass } from "./ui";
import { AdminHelp } from "./admin-help";

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
        تنظیمات برند، لوگوها و محتوای صفحه از همین بخش مدیریت می‌شوند. اگر فضای ذخیره‌سازی پایدار روی سرور پیکربندی شده باشد، بارگذاری مستقیم تصویر هم فعال می‌شود؛ در غیر این صورت می‌توانید نشانی عمومی HTTPS را ثبت کنید.
      </p>
      {notice ? (
        <p className="mt-3 text-sm font-bold text-forest" role="status">
          {notice}
        </p>
      ) : null}
      <AdminHelp title="محتوا و برند">این میز برای تغییر ظاهر و محتوای عمومی فروشگاه است، نه مدیریت کالا و قیمت. هر زبانه یک محل مشخص از سایت را کنترل می‌کند. بعد از ذخیره، صفحه عمومی مرتبط را بازخوانی کنید. بارگذاری فایل فقط وقتی فعال است که فضای ذخیره‌سازی پایدار و مجاز پیکربندی شده باشد؛ در غیر این صورت از نشانی عمومی HTTPS استفاده کنید.</AdminHelp>
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
          {tab === "home" ? <><AdminHelp title="صفحه اول" example="برای تغییر نام و لوگوی فروشگاه از «هویت برند» استفاده کنید؛ برای متن معرفی از «معرفی و نوار بالا» و برای بنر تبلیغاتی از «اسلایدها» استفاده کنید.">این زبانه چند قسمت مستقل دارد: هویت برند و لوگوها، متن معرفی، اطلاعات تماس، بخش‌های محتوایی و اسلایدهای صفحه اول. تغییر عنوان محصول یا قیمت از کاتالوگ انجام می‌شود، نه اینجا.</AdminHelp><HomeTab desk={desk} onDone={finish} onMove={move} /></> : null}
          {tab === "nav" ? <><AdminHelp title="منوهای سایت" example="عنوان «مجله» با نشانی /magazine یک پیوند داخلی است؛ برای یک سایت خارجی نشانی کامل https:// وارد کنید.">اینجا فقط عنوان و مقصد پیوندهای منوی هدر/فوتر و ترتیب آن‌ها تغییر می‌کند. برای افزودن صفحه جدید ابتدا آن را در «صفحه‌ها» بسازید و سپس نشانی همان صفحه را به منو اضافه کنید. خاموش‌کردن یک مورد آن را از نمایش عمومی پنهان می‌کند.</AdminHelp><NavTab desk={desk} onDone={finish} onMove={move} /></> : null}
          {tab === "pages" ? <><AdminHelp title="صفحه‌های ثابت" example="صفحه «درباره ما» می‌تواند نشانی about و محتوای معرفی فروشگاه داشته باشد.">برای ساخت و ویرایش صفحه‌های اطلاعاتی مانند درباره ما، تماس با ما و قوانین استفاده کنید. عنوان برای نمایش به کاربر است؛ شناسه انگلیسی بخشی از نشانی صفحه می‌شود و بهتر است پس از انتشار بی‌دلیل تغییر نکند.</AdminHelp><PagesTab desk={desk} onDone={finish} /></> : null}
          {tab === "magazine" ? <><AdminHelp title="مجله و مقاله‌ها" example="برای مقاله راهنمای نگهداری روغن، عنوان روشن، نشانی کوتاه مثل oil-care، خلاصه و تصویر مرتبط انتخاب کنید.">مقاله‌ها و محتوای تحریریه در این بخش مدیریت می‌شوند و با صفحه‌های ثابت تفاوت دارند. برای انتشار عمومی وضعیت انتشار و تاریخ را بررسی کنید؛ بازنشسته‌کردن مقاله آن را از فهرست عمومی خارج می‌کند، نه اینکه سفارش یا محصولی را تغییر دهد.</AdminHelp><MagazineTab desk={desk} onDone={finish} /></> : null}
          {tab === "media" ? <><AdminHelp title="کتابخانه رسانه" example="نام: olive-bottle-front؛ متن جایگزین: بطری روغن زیتون شاهو از نمای روبه‌رو؛ نشانی: https://example.com/olive.webp">رسانه‌ها تصاویر قابل استفاده در بنرها و محتوا هستند. نشانی خارجی باید مستقیم، عمومی و HTTPS باشد؛ متن جایگزین برای دسترس‌پذیری تصویر است. در صورت پیکربندی فضای ذخیره‌سازی پایدار، فرم بارگذاری فایل نیز نمایش داده می‌شود. پیش از کنارگذاشتن رسانه، محل‌های استفاده آن را بررسی کنید.</AdminHelp><MediaTab desk={desk} onDone={finish} /></> : null}
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
      <BrandSettingsForm desk={desk} onDone={onDone} />
      <CarouselSettingsForm desk={desk} onDone={onDone} />
      <StoreLayoutForm desk={desk} onDone={onDone} />
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
      <p className="text-sm leading-7 text-muted">اسلایدها بنرهای تصویری صفحه اول هستند. ترتیب نمایش با دکمه‌های بالا و پایین تعیین می‌شود؛ تاریخ شروع و پایان برای زمان‌بندی اختیاری‌اند.</p>
      {desk.banners.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm leading-7 text-muted">هنوز اسلایدی ثبت نشده است. از فرم «اسلاید تازه» پایین این قسمت برای ساخت اولین بنر استفاده کنید؛ تا وقتی رسانه‌ای انتخاب نکنید بنر بدون تصویر خواهد بود.</p> : null}
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

function CarouselSettingsForm({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [autoPlay, setAutoPlay] = useState(desk.carousel.autoPlay);
  const [intervalMs, setIntervalMs] = useState(String(desk.carousel.intervalMs));
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        const interval = Number(intervalMs);
        if (!Number.isInteger(interval) || interval < 3000 || interval > 15000) {
          setMessage("فاصله نمایش باید بین ۳ تا ۱۵ ثانیه باشد.");
          return;
        }
        void saveCarouselSettingsFn({ data: { autoPlay, intervalMs: interval } })
          .then(async (result) => {
            if (!result.ok) setMessage(result.message);
            else { setMessage("تنظیمات اسلایدر ذخیره شد."); await onDone(result); }
          })
          .catch(() => setMessage("ذخیره تنظیمات اسلایدر انجام نشد."));
      }}
    >
      <h2 className="font-bold text-forest">رفتار اسلایدر صفحه اول</h2>
      <p className="text-xs leading-6 text-muted">این تنظیم روی همه بنرهای فعال صفحه اول اثر می‌گذارد. مثال: ۶۵۰۰ میلی‌ثانیه یعنی هر ۶٫۵ ثانیه اسلاید بعدی نمایش داده می‌شود. با غیرفعال‌کردن پخش خودکار، بازدیدکننده همچنان می‌تواند دستی بین اسلایدها جابه‌جا شود. تنظیمات کاهش حرکت مرورگر همیشه رعایت می‌شود.</p>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest">
        <input type="checkbox" checked={autoPlay} onChange={(event) => setAutoPlay(event.target.checked)} />
        پخش خودکار اسلایدها فعال باشد
      </label>
      <label className="block space-y-1 text-sm">
        <span>فاصله بین اسلایدها (میلی‌ثانیه)</span>
        <input className={fieldClass} type="number" min={3000} max={15000} step={500} value={intervalMs} onChange={(event) => setIntervalMs(event.target.value)} dir="ltr" />
      </label>
      {message ? <p className="text-sm font-bold text-forest" role="status">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>ذخیره تنظیمات اسلایدر</button>
    </form>
  );
}

function StoreLayoutForm({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [stickyHeader, setStickyHeader] = useState(desk.layout.stickyHeader);
  const [headerLogoHeight, setHeaderLogoHeight] = useState(String(desk.layout.headerLogoHeight));
  const [footerLogoHeight, setFooterLogoHeight] = useState(String(desk.layout.footerLogoHeight));
  const [footerAlignment, setFooterAlignment] = useState(desk.layout.footerAlignment);
  const [message, setMessage] = useState("");
  return (
    <form className={`${panelClass} space-y-3 p-4`} onSubmit={(event) => {
      event.preventDefault();
      const headerHeight = Number(headerLogoHeight);
      const footerHeight = Number(footerLogoHeight);
      if (!Number.isInteger(headerHeight) || headerHeight < 40 || headerHeight > 80 || !Number.isInteger(footerHeight) || footerHeight < 64 || footerHeight > 144) {
        setMessage("اندازه لوگوی هدر باید ۴۰ تا ۸۰ و لوگوی فوتر ۶۴ تا ۱۴۴ پیکسل باشد.");
        return;
      }
      void saveStoreLayoutFn({ data: { stickyHeader, headerLogoHeight: headerHeight, footerLogoHeight: footerHeight, footerAlignment } })
        .then(async (result) => { if (!result.ok) setMessage(result.message); else { setMessage("چیدمان هدر و فوتر ذخیره شد."); await onDone(result); } })
        .catch(() => setMessage("ذخیره چیدمان انجام نشد."));
    }}>
      <h2 className="font-bold text-forest">چیدمان هدر و فوتر</h2>
      <p className="text-xs leading-6 text-muted">این تنظیمات فقط ظاهر سربرگ و پابرگ عمومی سایت را کنترل می‌کنند و روی محتوا، منوها یا اطلاعات سفارش‌ها اثری ندارند. نمونه: اگر هدر ثابت را خاموش کنید، با پایین‌رفتن صفحه سربرگ همراه کاربر نمی‌ماند.</p>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest"><input type="checkbox" checked={stickyHeader} onChange={(event) => setStickyHeader(event.target.checked)} /> هدر هنگام پیمایش ثابت بماند</label>
      <label className="block space-y-1 text-sm"><span>ارتفاع لوگوی هدر (پیکسل، ۴۰ تا ۸۰)</span><input className={fieldClass} type="number" min={40} max={80} step={1} value={headerLogoHeight} onChange={(event) => setHeaderLogoHeight(event.target.value)} dir="ltr" /></label>
      <label className="block space-y-1 text-sm"><span>ارتفاع لوگوی فوتر (پیکسل، ۶۴ تا ۱۴۴)</span><input className={fieldClass} type="number" min={64} max={144} step={1} value={footerLogoHeight} onChange={(event) => setFooterLogoHeight(event.target.value)} dir="ltr" /></label>
      <label className="block space-y-1 text-sm"><span>تراز محتوای فوتر</span><select className={fieldClass} value={footerAlignment} onChange={(event) => setFooterAlignment(event.target.value as "start" | "center")}><option value="start">ابتدای ستون‌ها</option><option value="center">وسط‌چین</option></select></label>
      {message ? <p className="text-sm font-bold text-forest" role="status">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>ذخیره چیدمان سایت</button>
    </form>
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
      <h2 className="font-bold text-forest">معرفی و نوار بالا</h2><p className="text-xs leading-6 text-muted">عنوان و متن داستان/معرفی فروشگاه و پیام کوتاه نوار بالای سایت را کنترل می‌کند. مثال نوار: «ارسال رایگان برای سفارش‌های بالای ... تومان». این متن با شعار برند یکی نیست.</p>
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

function BrandSettingsForm({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [brandName, setBrandName] = useState(desk.brandName);
  const [tagline, setTagline] = useState(desk.tagline);
  const [copyright, setCopyright] = useState(desk.copyright);
  const [headerLogo, setHeaderLogo] = useState(desk.logos.header);
  const [footerLogo, setFooterLogo] = useState(desk.logos.footer);
  const [message, setMessage] = useState("");
  return (
    <form
      className={`${panelClass} space-y-3 p-4`}
      onSubmit={(event) => {
        event.preventDefault();
        void saveBrandSettingsFn({ data: { brandName, tagline, copyright, headerLogo, footerLogo } })
          .then(async (result) => {
            if (!result.ok) setMessage(result.message);
            else { setMessage("تنظیمات برند ذخیره شد."); await onDone(result); }
          })
          .catch(() => setMessage("ذخیره تنظیمات برند انجام نشد."));
      }}
    >
      <h2 className="font-bold text-forest">هویت برند و لوگوها</h2><p className="text-xs leading-6 text-muted">نام برند برای متن جایگزین لوگو، شعار در معرفی برند و کپی‌رایت در فوتر مصرف می‌شود. نمونه کپی‌رایت: «© ۲۰۲۶ شاهو؛ تمامی حقوق محفوظ است.»</p>
      <p className="text-xs leading-6 text-muted">این مقادیر منبع مرکزی هدر و فوتر هستند. برای لوگو از مسیر /assets/brand/ یا نشانی عمومی HTTPS با پسوند PNG، JPG یا WebP استفاده کنید.</p>
      <label className="block space-y-1 text-sm"><span>نام برند</span><input className={fieldClass} value={brandName} onChange={(event) => setBrandName(event.target.value)} maxLength={80} /></label>
      <label className="block space-y-1 text-sm"><span>شعار فروشگاه</span><input className={fieldClass} value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={180} /></label>
      <label className="block space-y-1 text-sm"><span>متن کپی‌رایت</span><input className={fieldClass} value={copyright} onChange={(event) => setCopyright(event.target.value)} maxLength={180} /></label>
      <label className="block space-y-1 text-sm"><span>لوگوی هدر</span><input className={fieldClass} dir="ltr" value={headerLogo} onChange={(event) => setHeaderLogo(event.target.value)} maxLength={500} /></label>
      <label className="block space-y-1 text-sm"><span>لوگوی فوتر</span><input className={fieldClass} dir="ltr" value={footerLogo} onChange={(event) => setFooterLogo(event.target.value)} maxLength={500} /></label>
      {message ? <p className="text-sm font-bold text-forest" role="status">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>ذخیره هویت برند</button>
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
      <h2 className="font-bold text-forest">راه‌های تماس</h2><p className="text-xs leading-6 text-muted">اطلاعات واقعی پاسخ‌گویی و نشانی فروشگاه را وارد کنید؛ این داده‌ها ممکن است در فوتر و صفحه تماس نمایش داده شوند. نمونه تلفن: ۰۲۱۱۲۳۴۵۶۷۸ و نمونه شبکه اجتماعی: https://instagram.com/yourstore</p>
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
        <h2 className="font-bold text-forest">{label}</h2><p className="text-xs leading-6 text-muted">عنوان و زیرعنوان روی کارت این بخش در صفحه اول دیده می‌شود. بخش محصولی تعداد و ویژگی‌های نمایشی را تعیین می‌کند؛ فعال‌بودن یعنی امکان نمایش عمومی، به شرط آنکه خود بخش از نوع قابل نمایش باشد.</p>
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
        <h2 className="font-bold text-forest">{banner ? "اسلاید" : "اسلاید تازه"}</h2><p className="w-full text-xs leading-6 text-muted">اسلاید یک بنر تصویری صفحه اول است. عنوان و متن، پیام را می‌سازند؛ متن دکمه و نشانی آن مقصد کلیک را مشخص می‌کند. مثال: «مشاهده محصولات» و /products. تاریخ شروع/پایان اختیاری‌اند؛ تصویر دسکتاپ و موبایل را جدا انتخاب کنید.</p>
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
      {desk.menus.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm leading-7 text-muted">منویی برای ویرایش در پایگاه داده تعریف نشده است. این میز در حال حاضر منوهای موجود را ویرایش می‌کند و امکان ساخت گروه منوی تازه هنوز فراهم نیست.</p> : null}
      {desk.menus.map((menu) => (
        <section key={menu.key} className="space-y-3">
          <h2 className="font-bold text-forest">{menu.name}</h2><p className="text-xs leading-6 text-muted">این گروه از پیوندها در بخش «{menu.name}» سایت نمایش داده می‌شود. عنوان کوتاه و مقصد معتبر وارد کنید؛ برای تغییر ترتیب از دکمه‌های بالا/پایین استفاده کنید.</p>
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
      {desk.pages.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm leading-7 text-muted">هنوز صفحه ثابتی ساخته نشده است. این وضعیت طبیعی است؛ برای شروع روی «صفحه تازه» بزنید و مثلاً صفحه درباره ما یا قوانین را بسازید.</p> : null}
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
      <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان صفحه" placeholder="عنوان قابل نمایش؛ مثلاً درباره ما" />
      <p className="text-xs leading-6 text-muted">متن ساده و فارسی پذیرفته می‌شود؛ برای شروع بند تازه یک خط خالی بگذارید. HTML اجرا نمی‌شود.</p>
      <textarea className={`${fieldClass} min-h-40`} value={body} onChange={(event) => setBody(event.target.value)} aria-label="متن صفحه" />
      <input className={fieldClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} aria-label="عنوان سئو" placeholder="عنوان سئو؛ خالی = عنوان صفحه" />
      <input className={fieldClass} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} aria-label="شرح سئو" placeholder="خلاصه صفحه برای نتایج جست‌وجو" />
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
        منتشر شده
      </label>
      {message ? <p className="text-sm font-bold text-forest">{message}</p> : null}
      <button type="submit" className={buttonPrimary}>
        ذخیره صفحه
      </button>
      {page ? <a href={`/admin/content-preview/page/${encodeURIComponent(page.slug)}`} target="_blank" rel="noreferrer" className={buttonGhost}>پیش‌نمایش نسخه ذخیره‌شده</a> : null}
      {page ? <ContentHistory entityType="page" entityId={page.id} onDone={onDone} /> : null}
    </form>
  );
}

function ContentHistory({
  entityType,
  entityId,
  onDone,
}: {
  entityType: "page" | "article";
  entityId: string;
  onDone: (result: CmsResult) => Promise<void>;
}) {
  const [items, setItems] = useState<Array<{ id: string; version: number; createdAt: string; title: string; status: string }> | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getContentHistoryFn({ data: { entityType, entityId } })
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setError("تاریخچه نسخه‌ها بارگذاری نشد."); });
    return () => { active = false; };
  }, [entityType, entityId]);
  return (
    <section className="space-y-2 rounded-2xl border border-line p-3">
      <div>
        <h3 className="text-sm font-bold text-forest">تاریخچه و بازگردانی</h3>
        <p className="mt-1 text-xs leading-6 text-muted">هر بار ذخیره یا انتشار، یک نسخه مستقل ثبت می‌شود. بازگردانی، نسخه تازه‌ای می‌سازد و نسخه‌های قبلی را حذف نمی‌کند.</p>
      </div>
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
      {items === null && !error ? <p className="text-xs text-muted">در حال خواندن تاریخچه...</p> : null}
      {items?.length === 0 ? <p className="text-xs text-muted">هنوز نسخه‌ای ثبت نشده است. پس از ذخیره بعدی، تاریخچه اینجا نمایش داده می‌شود.</p> : null}
      {items?.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-forest">نسخه {item.version} · {item.title}</p>
            <p className="text-xs text-muted">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))} · {item.status === "published" ? "منتشرشده" : "پیش‌نویس"}</p>
          </div>
          <button
            type="button"
            className={buttonGhost}
            disabled={busyId !== ""}
            onClick={() => {
              setBusyId(item.id);
              setError("");
              void restoreContentRevisionFn({ data: { revisionId: item.id } })
                .then(onDone)
                .catch(() => setError("بازگردانی انجام نشد."))
                .finally(() => setBusyId(""));
            }}
          >
            {busyId === item.id ? "در حال بازگردانی..." : "بازگردانی این نسخه"}
          </button>
        </div>
      ))}
    </section>
  );
}

function MagazineTab({ desk, onDone }: { desk: CmsDesk; onDone: (result: CmsResult) => Promise<void> }) {
  const [articleId, setArticleId] = useState<string>("new");
  const [query, setQuery] = useState("");
  const article = desk.articles.find((item) => item.id === articleId) ?? null;
  return (
    <div className="space-y-3">
      {desk.articles.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm leading-7 text-muted">هنوز مقاله‌ای ثبت نشده است. برای ساخت اولین مطلب روی «مقاله تازه» بزنید؛ تا زمانی که وضعیت «منتشر شده» انتخاب نشود، مقاله عمومی نخواهد بود.</p> : null}
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
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="عنوان مقاله" placeholder="عنوان مقاله؛ مثلاً راهنمای انتخاب روغن زیتون" />
        <input className={fieldClass} value={slug} onChange={(event) => setSlug(event.target.value)} aria-label="نامک مقاله" dir="ltr" />
      </div>
      <textarea className={`${fieldClass} min-h-20`} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} aria-label="خلاصه" placeholder="خلاصه ۲ تا ۳ جمله‌ای برای فهرست مجله" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} aria-label="عنوان سئو مقاله" placeholder="عنوان سئو؛ خالی = عنوان مقاله" maxLength={120} />
        <input className={fieldClass} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} aria-label="شرح سئو مقاله" placeholder="شرح سئو؛ خالی = خلاصه" maxLength={240} />
      </div>
      <p className="text-xs leading-6 text-muted">متن مقاله ساده و فارسی است؛ برای شروع بند تازه یک خط خالی بگذارید. HTML اجرا نمی‌شود.</p>
      <textarea className={`${fieldClass} min-h-40`} value={content} onChange={(event) => setContent(event.target.value)} aria-label="متن مقاله" />
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={fieldClass} value={authorName} onChange={(event) => setAuthorName(event.target.value)} aria-label="نویسنده" placeholder="نام نویسنده یا تیم؛ مثلاً کارگاه شاهو" />
        <input className={fieldClass} value={readMinutes} onChange={(event) => setReadMinutes(event.target.value)} aria-label="دقیقه مطالعه" inputMode="numeric" placeholder="زمان مطالعه؛ مثلاً ۴ دقیقه" />
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
      {article ? <a href={`/admin/content-preview/article/${encodeURIComponent(article.slug)}`} target="_blank" rel="noreferrer" className={buttonGhost}>پیش‌نمایش نسخه ذخیره‌شده</a> : null}
      {article ? <ContentHistory entityType="article" entityId={article.id} onDone={onDone} /> : null}
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);

  async function upload() {
    if (uploading) return;
    const invalid = validateUploadFile(uploadFile);
    if (invalid) { setMessage({ text: invalid, error: true }); return; }
    if (!uploadFile) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("alt", uploadAlt);
      const result = await uploadMedia((url, init) => fetch(url, init as RequestInit), form);
      if (!result.ok) { setMessage({ text: result.message, error: true }); return; }
      setUploadFile(null);
      setUploadAlt("");
      setUploadInputKey((value) => value + 1);
      await onDone({ ok: true });
    } catch {
      setMessage({ text: "بارگذاری انجام نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.", error: true });
    } finally {
      setUploading(false);
    }
  }

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
      {desk.uploadEnabled ? (
        <form className={`${panelClass} space-y-3 p-4`} onSubmit={(event) => { event.preventDefault(); void upload(); }}>
          <h2 className="font-bold text-forest">بارگذاری تصویر در کتابخانه</h2>
          <p className="text-xs leading-6 text-muted">فقط JPEG، PNG یا GIF سالم تا ۴ مگابایت پذیرفته می‌شود. تصویر در سرور ذخیره و پس از ثبت در بنرها و محتوای سایت قابل انتخاب است.</p>
          <input key={uploadInputKey} className={fieldClass} type="file" accept="image/jpeg,image/png,image/gif" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} aria-label="انتخاب فایل تصویر" />
          <input className={fieldClass} value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} maxLength={120} aria-label="متن جایگزین تصویر" placeholder="متن جایگزین تصویر (اختیاری)" />
          <button type="submit" className={buttonPrimary} disabled={uploading}>{uploading ? "در حال بارگذاری..." : "بارگذاری تصویر"}</button>
        </form>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm leading-7 text-muted">بارگذاری مستقیم فایل در این محیط غیرفعال است؛ برای جلوگیری از ذخیره روی دیسک موقت، ابتدا فضای ذخیره‌سازی پایدار را پیکربندی کنید. فعلاً می‌توانید نشانی عمومی HTTPS را ثبت کنید.</p>
      )}
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
        <input className={fieldClass} value={alt} onChange={(event) => setAlt(event.target.value)} aria-label="متن جایگزین" placeholder="توصیف کوتاه تصویر برای دسترس‌پذیری" />
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
