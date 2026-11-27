import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Droplets,
  Hand,
  Leaf,
  Search,
  Waves,
} from "lucide-react";
import type {
  GuideArea,
  GuideCategory,
  GuideConcern,
  GuideOilCard,
  GuideSourceStatus,
} from "@/server/oil-encyclopedia/guide";

type Result<T> = { status: GuideSourceStatus; data: T };

const areaIcons = {
  hair: Waves,
  skin: Droplets,
  topical: Hand,
  "topical-use": Hand,
} as const;

function SourceNotice({ status, empty = false }: { status: GuideSourceStatus; empty?: boolean }) {
  if (status === "disabled") {
    return (
      <div className="rounded-2xl border border-line bg-paper p-5 text-sm leading-7 text-muted">
        منبع دانشنامه هنوز به این محیط متصل نشده است. ساختار راهنما آماده است؛ پس از واردسازی امن دانشنامه و اتصال فقط‌خواندنی، دسته‌ها و روغن‌های تأییدشده از پایگاه داده نمایش داده می‌شوند.
      </div>
    );
  }
  if (status === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
        ارتباط با منبع دانشنامه در حال حاضر در دسترس نیست. برای جلوگیری از نمایش داده تأییدنشده، نتیجه‌ای از منبع جایگزین ساخته نشده است.
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-6 text-center">
        <BookOpen className="mx-auto mb-3 h-7 w-7 text-gold" aria-hidden="true" />
        <p className="font-semibold text-forest">هنوز محتوای تأییدشده‌ای برای نمایش وجود ندارد</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          رکوردهای دانشنامه تا ثبت تأیید نهایی و انتشار مجاز، در بخش عمومی نمایش داده نمی‌شوند.
        </p>
      </div>
    );
  }
  return null;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold tracking-wide text-gold">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold text-forest md:text-2xl">{title}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
    </div>
  );
}

function OilCards({ oils }: { oils: GuideOilCard[] }) {
  const [kind, setKind] = useState("");
  const [texture, setTexture] = useState("");
  const kinds = useMemo(() => [...new Set(oils.map((oil) => oil.oilKind).filter((value): value is string => Boolean(value)))].sort(), [oils]);
  const textures = useMemo(() => [...new Set(oils.map((oil) => oil.texture).filter((value): value is string => Boolean(value)))].sort(), [oils]);
  const filtered = useMemo(
    () => oils.filter((oil) => (!kind || oil.oilKind === kind) && (!texture || oil.texture === texture)),
    [kind, oils, texture],
  );
  if (oils.length === 0) return null;
  return (
    <div className="space-y-4">
      {(kinds.length > 1 || textures.length > 1) ? (
        <div className="flex flex-wrap gap-2">
          {kinds.length > 1 ? (
            <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs text-muted">
              نوع روغن
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="max-w-40 bg-transparent text-forest outline-none">
                <option value="">همه انواع</option>
                {kinds.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ) : null}
          {textures.length > 1 ? (
            <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs text-muted">
              بافت
              <select value={texture} onChange={(event) => setTexture(event.target.value)} className="max-w-40 bg-transparent text-forest outline-none">
                <option value="">همه بافت‌ها</option>
                {textures.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((oil) => (
            <Link
              key={oil.oilId}
              to="/oil-guide/oils/$oilSlug"
              params={{ oilSlug: oil.slug }}
              className="group rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-gold/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-forest">{oil.nameFa || oil.nameEn}</h3>
                  {oil.nameEn ? <p className="mt-1 text-xs text-muted" dir="ltr">{oil.nameEn}</p> : null}
                </div>
                <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-gold transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              </div>
              {oil.scientificName ? <p className="mt-3 text-xs text-muted" dir="ltr">{oil.scientificName}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
                <span className="rounded-full bg-cream px-2.5 py-1">{oil.categoryNameFa}</span>
                {oil.concernNameFa ? <span className="rounded-full bg-cream px-2.5 py-1">{oil.concernNameFa}</span> : null}
                {oil.evidenceLevel ? <span className="rounded-full bg-cream px-2.5 py-1">سطح شواهد: {oil.evidenceLevel}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-paper p-4 text-sm text-muted">با این فیلترها روغنی پیدا نشد.</p>
      )}
    </div>
  );
}

function CategoryNode({
  category,
  childrenByParent,
  visited = new Set<string>(),
}: {
  category: GuideCategory;
  childrenByParent: Map<string, GuideCategory[]>;
  visited?: Set<string>;
}) {
  if (visited.has(category.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(category.id);
  const children = childrenByParent.get(category.id) ?? [];
  return (
    <div className="space-y-2">
      <Link
        to="/oil-guide/$areaSlug/$categorySlug"
        params={{ areaSlug: category.areaSlug, categorySlug: category.slug }}
        className="block rounded-2xl border border-line bg-paper p-5 hover:border-gold/60"
      >
        <h2 className="font-bold text-forest">{category.nameFa}</h2>
        {category.nameEn ? <p className="mt-1 text-xs text-muted" dir="ltr">{category.nameEn}</p> : null}
        {category.description ? <p className="mt-3 text-sm leading-7 text-muted">{category.description}</p> : null}
        <p className="mt-4 text-xs text-muted">{category.availableOilCount.toLocaleString("fa-IR")} روغن دارای اطلاعات قابل انتشار</p>
      </Link>
      {children.length ? (
        <div className="mr-4 space-y-2 border-r border-line pr-3">
          {children.map((child) => (
            <CategoryNode key={child.id} category={child} childrenByParent={childrenByParent} visited={nextVisited} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OilGuideLanding({
  result,
  compact = false,
}: {
  result: Result<GuideArea[]>;
  compact?: boolean;
}) {
  const areas = result.data;
  return (
    <section className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:py-10">
      {!compact ? (
      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-paper px-6 py-9 md:px-10 md:py-12">
        <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-cream/80 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold tracking-[0.18em] text-gold">SHAHOO · OIL KNOWLEDGE GUIDE</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-forest md:text-4xl">راهنمای روغن شاهو</h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-muted md:text-base">
            روغن‌ها را بر اساس ناحیه موردنظر، موضوع مراقبت و اطلاعات مستند هر روغن بررسی کنید. محتوای این راهنما فقط پس از بررسی و تأیید نهایی منتشر می‌شود.
          </p>
          <form action="/oil-guide/search" method="get" className="mt-7 flex max-w-xl gap-2 rounded-2xl border border-line bg-white p-2">
            <Search className="my-auto mr-2 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <input
              type="search"
              name="q"
              maxLength={80}
              placeholder="نام فارسی، انگلیسی یا گیاه‌شناسی روغن..."
              aria-label="جستجو در راهنمای روغن"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-forest outline-none placeholder:text-muted"
            />
            <button type="submit" className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white">جستجو</button>
          </form>
        </div>
      </header>
      ) : null}

      <section>
        <SectionHeading
          eyebrow={compact ? "BROWSE THE ENCYCLOPEDIA" : "EXPLORE BY AREA"}
          title={compact ? "مرور موضوعی دانشنامه" : "از کجا می‌خواهید شروع کنید؟"
          description="هر روغن فقط در دسته‌هایی نمایش داده می‌شود که ارتباط آن در داده‌های دانشنامه ثبت شده و مجوز انتشار عمومی گرفته باشد."
        />
        {areas.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {areas.map((area) => {
              const Icon = areaIcons[area.slug as keyof typeof areaIcons] ?? Leaf;
              return (
                <Link
                  key={area.id}
                  to="/oil-guide/$areaSlug"
                  params={{ areaSlug: area.slug }}
                  className="group rounded-3xl border border-line bg-paper p-6 transition-all hover:-translate-y-0.5 hover:border-gold/60"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-forest">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-forest">{area.nameFa}</h3>
                    <ArrowLeft className="h-4 w-4 text-gold transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-wide text-muted" dir="ltr">{area.nameEn}</p>
                  <p className="mt-3 text-sm leading-7 text-muted">{area.description}</p>
                  <p className="mt-5 text-xs font-semibold text-forest">{area.availableOilCount.toLocaleString("fa-IR")} روغن دارای اطلاعات قابل انتشار</p>
                </Link>
              );
            })}
          </div>
        ) : <SourceNotice status={result.status} empty={result.status === "ready"} />}
      </section>
    </section>
  );
}

export function OilGuideAreaPage({
  status,
  area,
  categories,
  oils,
}: {
  status: GuideSourceStatus;
  area: GuideArea | null;
  categories: GuideCategory[];
  oils: GuideOilCard[];
}) {
  if (status !== "ready") return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status={status} /></main>;
  if (!area) return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status="ready" empty /></main>;
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <Link to="/oil-guide" className="text-sm text-muted hover:text-forest">راهنمای روغن / همه ناحیه‌ها</Link>
      <header>
        <p className="text-xs font-bold text-gold" dir="ltr">{area.nameEn}</p>
        <h1 className="mt-2 text-3xl font-bold text-forest">{area.nameFa}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-8 text-muted">{area.description}</p>
      </header>
      <section>
        <SectionHeading eyebrow="CATEGORIES" title="دسته‌بندی‌ها" />
        {categories.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(() => {
              const ids = new Set(categories.map((category) => category.id));
              const childrenByParent = new Map<string, GuideCategory[]>();
              for (const category of categories) {
                if (!category.parentId || !ids.has(category.parentId)) continue;
                const children = childrenByParent.get(category.parentId) ?? [];
                children.push(category);
                childrenByParent.set(category.parentId, children);
              }
              const roots = categories.filter((category) => !category.parentId || !ids.has(category.parentId));
              return roots.map((category) => (
                <CategoryNode key={category.id} category={category} childrenByParent={childrenByParent} />
              ));
            })()}
          </div>
        ) : <SourceNotice status="ready" empty />}
      </section>
      <section>
        <SectionHeading eyebrow="APPROVED OILS" title="روغن‌های این ناحیه" />
        {oils.length ? <OilCards oils={oils} /> : <SourceNotice status="ready" empty />}
      </section>
    </main>
  );
}

export function OilGuideCategoryPage({
  status,
  category,
  children,
  concerns,
  oils,
}: {
  status: GuideSourceStatus;
  category: GuideCategory | null;
  children: GuideCategory[];
  concerns: GuideConcern[];
  oils: GuideOilCard[];
}) {
  if (status !== "ready") return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status={status} /></main>;
  if (!category) return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status="ready" empty /></main>;
  return (
    <main className="mx-auto max-w-5xl space-y-9 px-4 py-10">
      <Link to="/oil-guide/$areaSlug" params={{ areaSlug: category.areaSlug }} className="text-sm text-muted hover:text-forest">بازگشت به ناحیه</Link>
      <header>
        <p className="text-xs font-bold text-gold" dir="ltr">{category.nameEn || "OIL GUIDE CATEGORY"}</p>
        <h1 className="mt-2 text-3xl font-bold text-forest">{category.nameFa}</h1>
        {category.description ? <p className="mt-3 max-w-2xl text-sm leading-8 text-muted">{category.description}</p> : null}
      </header>
      {children.length ? (
        <section>
          <SectionHeading eyebrow="SUBCATEGORIES" title="زیر‌دسته‌ها" />
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <Link key={child.id} to="/oil-guide/$areaSlug/$categorySlug" params={{ areaSlug: child.areaSlug, categorySlug: child.slug }} className="rounded-2xl border border-line bg-paper p-5 hover:border-gold/60">
                <h2 className="font-bold text-forest">{child.nameFa}</h2>
                {child.nameEn ? <p className="mt-1 text-xs text-muted" dir="ltr">{child.nameEn}</p> : null}
                <p className="mt-3 text-xs text-muted">{child.availableOilCount.toLocaleString("fa-IR")} روغن دارای اطلاعات قابل انتشار</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {concerns.length ? (
        <section>
          <SectionHeading eyebrow="CONCERNS & PURPOSES" title="موضوعات مرتبط" description="این موضوعات از ارتباط‌های تأییدشده در دانشنامه استخراج می‌شوند." />
          <div className="flex flex-wrap gap-2">
            {concerns.map((concern) => (
              <Link key={concern.id} to="/oil-guide/$areaSlug/$categorySlug/$concernSlug" params={{ areaSlug: concern.areaSlug, categorySlug: concern.categorySlug, concernSlug: concern.slug }} className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-forest hover:border-gold/60">
                {concern.nameFa} <span className="mr-1 text-xs text-muted">({concern.availableOilCount.toLocaleString("fa-IR")})</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <SectionHeading eyebrow="APPROVED OILS" title="روغن‌های دارای اطلاعات قابل انتشار" />
        {oils.length ? <OilCards oils={oils} /> : <SourceNotice status="ready" empty />}
      </section>
    </main>
  );
}

export function OilGuideConcernPage({
  status,
  concern,
  oils,
}: {
  status: GuideSourceStatus;
  concern: GuideConcern | null;
  oils: GuideOilCard[];
}) {
  if (status !== "ready") return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status={status} /></main>;
  if (!concern) return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status="ready" empty /></main>;
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <Link to="/oil-guide/$areaSlug/$categorySlug" params={{ areaSlug: concern.areaSlug, categorySlug: concern.categorySlug }} className="text-sm text-muted hover:text-forest">بازگشت به دسته‌بندی</Link>
      <header>
        <p className="text-xs font-bold text-gold">موضوع راهنما</p>
        <h1 className="mt-2 text-3xl font-bold text-forest">{concern.nameFa}</h1>
      </header>
      {oils.length ? <OilCards oils={oils} /> : <SourceNotice status="ready" empty />}
    </main>
  );
}

export function OilGuideSearchPage({
  status,
  query,
  oils,
}: {
  status: GuideSourceStatus;
  query: string;
  oils: GuideOilCard[];
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-10">
      <Link to="/oil-guide" className="text-sm text-muted hover:text-forest">راهنمای روغن</Link>
      <header>
        <p className="text-xs font-bold text-gold">SEARCH THE OIL GUIDE</p>
        <h1 className="mt-2 text-3xl font-bold text-forest">جستجو در راهنمای روغن</h1>
        <p className="mt-2 text-sm text-muted">عبارت جستجو: {query || "—"}</p>
      </header>
      {status !== "ready" ? <SourceNotice status={status} /> : oils.length ? <OilCards oils={oils} /> : <SourceNotice status="ready" empty />}
    </main>
  );
}

function valueOf(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join("، ");
  return typeof value === "string" ? value : "";
}

function ProfileField({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="rounded-2xl bg-paper p-4">
      <p className="text-xs font-semibold text-gold">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-8 text-forest">{value}</p>
    </div>
  );
}

export function OilGuideOilProfilePage({
  status,
  profile,
  claims,
  protocols,
  faqs,
  qa,
  warnings,
}: {
  status: GuideSourceStatus;
  profile: Record<string, unknown> | null;
  claims: Record<string, unknown>[];
  protocols: Record<string, unknown>[];
  faqs: Record<string, unknown>[];
  qa: Record<string, unknown>[];
  warnings: Record<string, unknown>[];
}) {
  if (status !== "ready") return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status={status} /></main>;
  if (!profile) return <main className="mx-auto max-w-5xl px-4 py-12"><SourceNotice status="ready" empty /></main>;
  const title = valueOf(profile, "name_fa") || valueOf(profile, "name_en");
  const groups = [
    { title: "هویت گیاه‌شناسی", fields: [["نام علمی", "scientific_name"], ["نام INCI", "inci_name"], ["خانواده گیاهی", "family"], ["بخش گیاه", "plant_part"]] },
    { title: "ویژگی‌های عمومی", fields: [["نوع روغن", "oil_kind"], ["ظاهر", "appearance"], ["رنگ", "color"], ["رایحه", "odor"], ["بافت", "texture"], ["ترکیبات شاخص", "key_components"], ["اسیدهای چرب شاخص", "key_fatty_acids"], ["مواد فعال شناخته‌شده", "known_actives"], ["پایداری اکسیداتیو", "oxidation_stability"]] },
    { title: "استخراج و نگهداری", fields: [["اطلاعات کلی استخراج", "general_extraction"], ["شرایط نگهداری", "general_storage"]] },
    { title: "کاربردهای تأییدشده", fields: [["ساقه مو", "use_hair_shaft"], ["پوست سر", "use_scalp"], ["نوع مو", "use_hair_types"], ["صورت", "use_face"], ["بدن", "use_body"], ["ماساژ", "use_massage"], ["کاربردهای سنتی", "use_traditional"]] },
  ];
  return (
    <main className="mx-auto max-w-5xl space-y-9 px-4 py-10">
      <Link to="/oil-guide" className="text-sm text-muted hover:text-forest">راهنمای روغن</Link>
      <header className="rounded-3xl border border-line bg-paper p-6 md:p-9">
        <p className="text-xs font-bold text-gold">OIL PROFILE · {valueOf(profile, "oil_id")}</p>
        <h1 className="mt-3 text-3xl font-bold text-forest">{title}</h1>
        {valueOf(profile, "name_en") ? <p className="mt-2 text-sm text-muted" dir="ltr">{valueOf(profile, "name_en")}</p> : null}
        {valueOf(profile, "scientific_name") ? <p className="mt-4 text-sm text-muted" dir="ltr">{valueOf(profile, "scientific_name")}</p> : null}
      </header>
      {groups.map((group) => {
        const fields = group.fields.map(([label, key]) => ({ label, value: valueOf(profile, key) })).filter((field) => field.value);
        return fields.length ? (
          <section key={group.title}>
            <SectionHeading eyebrow="APPROVED PROFILE DATA" title={group.title} />
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => <ProfileField key={field.label} {...field} />)}
            </div>
          </section>
        ) : null;
      })}
      {warnings.length ? (
        <section>
          <SectionHeading eyebrow="SAFETY" title="ملاحظات ایمنی تأییدشده" />
          <div className="space-y-3">{warnings.map((item, index) => <ProfileField key={index} label={valueOf(item, "customer_display_scope") || "هشدار ایمنی"} value={valueOf(item, "customer_text")} />)}</div>
        </section>
      ) : null}
      {claims.length ? (
        <section>
          <SectionHeading eyebrow="APPROVED INFORMATION" title="اطلاعات و شواهد قابل انتشار" />
          <div className="space-y-3">{claims.map((item) => <ProfileField key={valueOf(item, "claim_id")} label="اطلاعات تأییدشده" value={valueOf(item, "customer_text")} />)}</div>
        </section>
      ) : null}
      {protocols.length ? (
        <section>
          <SectionHeading eyebrow="APPROVED USE" title="راهنمای مصرف تأییدشده" />
          <div className="space-y-3">{protocols.map((item) => <ProfileField key={valueOf(item, "protocol_id")} label={valueOf(item, "purpose") || "روش مصرف"} value={valueOf(item, "customer_text")} />)}</div>
        </section>
      ) : null}
      {faqs.length || qa.length ? (
        <section>
          <SectionHeading eyebrow="QUESTIONS & ANSWERS" title="پرسش‌های متداول" />
          <div className="space-y-3">
            {[...faqs.map((item) => ({ q: valueOf(item, "question"), a: valueOf(item, "answer") })), ...qa.map((item) => ({ q: valueOf(item, "question_key"), a: valueOf(item, "answer") }))].map((item, index) => (
              <div key={index} className="rounded-2xl border border-line bg-paper p-4">
                <p className="font-semibold text-forest">{item.q}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-8 text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <p className="text-xs leading-7 text-muted">این صفحه فقط داده‌هایی را نمایش می‌دهد که از نماهای عمومی و دارای تأیید نهایی دانشنامه دریافت شده‌اند. اطلاعات سنتی، در صورت انتشار، به‌عنوان اطلاعات سنتی برچسب‌گذاری می‌شوند و معادل اثربخشی علمی نیستند.</p>
    </main>
  );
}
