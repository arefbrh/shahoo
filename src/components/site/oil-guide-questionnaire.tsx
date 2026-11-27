import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  CircleAlert,
  Leaf,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  OilGuideQuestionnaireData,
  OilGuideRecommendationResult,
  QuestionnaireArea,
  QuestionnaireCategory,
  QuestionnaireConcern,
} from "@/server/oil-encyclopedia/recommendations";
import { submitOilGuideAnswers } from "@/server/oil-guide/recommendations-api";

type InitialData = {
  status: "ready" | "disabled" | "unavailable";
  data: OilGuideQuestionnaireData;
};

type StepKey = "area" | "category" | "concern" | "texture";
type Step = { key: StepKey; label: string };

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function ChoiceButton({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition-colors",
        selected
          ? "border-gold bg-cream text-forest shadow-sm"
          : "border-line bg-white text-forest hover:border-gold/60",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {subtitle ? <span className="mt-1 block text-xs text-muted" dir="auto">{subtitle}</span> : null}
      </span>
      <span className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-forest bg-forest text-white" : "border-line bg-paper text-transparent",
      ].join(" ")}>
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function SourceState({ status }: { status: "disabled" | "unavailable" }) {
  const disabled = status === "disabled";
  return (
    <div className="rounded-3xl border border-line bg-white p-6 md:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-forest">
        {disabled ? <Leaf className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
      </div>
      <h2 className="mt-4 text-lg font-bold text-forest">
        {disabled ? "بانک دانشنامه به این محیط متصل نیست" : "ارتباط با بانک دانشنامه برقرار نشد"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
        {disabled
          ? "برای حفظ دقت پیشنهادها، راهنما تا زمان اتصال منبع جداگانه و فقط‌خواندنی، روغنی را حدس نمی‌زند و از فهرست فروشگاه به‌عنوان جایگزین استفاده نمی‌کند."
          : "در حال حاضر امکان خواندن اطلاعات تأییدشده وجود ندارد. برای جلوگیری از پیشنهاد بر پایه داده ناقص، نتیجه‌ای ساخته نشده است. لطفاً بعداً دوباره تلاش کنید."}
      </p>
      <a href="/oil-guide/search" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest underline decoration-gold underline-offset-4">
        مرور محتوای قابل انتشار
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function ReadinessNotice({
  total,
  eligible,
}: {
  total: number;
  eligible: number;
}) {
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-4 text-sm leading-7 text-muted">
        بانک روغن در این محیط هنوز داده قابل شمارش ندارد. تا زمان بارگذاری و بررسی منبع، پیشنهاد ساخته نمی‌شود.
      </div>
    );
  }
  if (eligible >= 3) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-white px-4 py-3 text-xs text-muted">
        <span><strong className="text-forest">{total.toLocaleString("fa-IR")}</strong> روغن در بانک دانشنامه</span>
        <span><strong className="text-forest">{eligible.toLocaleString("fa-IR")}</strong> روغن دارای شرایط پیشنهاددهی تأییدشده</span>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
      <strong>{total.toLocaleString("fa-IR")} روغن</strong> در مجموعه کاندیداهای دانشنامه قرار دارند؛ اما در حال حاضر فقط{" "}
      <strong>{eligible.toLocaleString("fa-IR")}</strong> روغن از نظر اطلاعات ساختاریافته و بررسی ایمنی مجوز پیشنهاددهی دارند.
      تا تأیید حداقل سه روغن، نتیجه‌ای ساخته یا با داده ساختگی تکمیل نمی‌شود.
    </div>
  );
}

function RecommendationCard({
  recommendation,
  rank,
}: {
  recommendation: OilGuideRecommendationResult["recommendations"][number];
  rank: number;
}) {
  const primary = rank === 1;
  const commerceLabel = {
    available: "در فروشگاه موجود است",
    out_of_stock: "محصول ثبت شده، اما فعلاً موجود نیست",
    not_mapped: "فعلاً در فروشگاه عرضه نشده",
    unavailable: "وضعیت عرضه در فروشگاه مشخص نیست",
  }[recommendation.commerce.availability];

  return (
    <article className={[
      "overflow-hidden rounded-3xl border bg-white",
      primary ? "border-gold shadow-md" : "border-line",
    ].join(" ")}>
      <div className={[
        "flex items-center justify-between gap-3 px-5 py-4",
        primary ? "bg-forest text-white" : "bg-paper text-forest",
      ].join(" ")}>
        <div className="flex items-center gap-3">
          <span className={[
            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
            primary ? "bg-gold text-forest" : "bg-cream text-forest",
          ].join(" ")}>{rank.toLocaleString("fa-IR")}</span>
          <span className="text-sm font-semibold">{["بهترین تطابق", "تطابق دوم", "تطابق سوم"][rank - 1]}</span>
        </div>
        <div className="text-left">
          <span className="block text-[11px] opacity-75">امتیاز تطابق</span>
          <strong className="text-xl tabular-nums">{recommendation.score.toLocaleString("fa-IR")}<span className="mr-1 text-xs">از ۱۰۰</span></strong>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-xl font-bold text-forest">{recommendation.nameFa}</h3>
          {recommendation.nameEn ? <p className="mt-1 text-sm text-muted" dir="ltr">{recommendation.nameEn}</p> : null}
          {recommendation.scientificName ? <p className="mt-1 text-xs text-muted" dir="ltr">{recommendation.scientificName}</p> : null}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-cream" aria-label={"امتیاز تطابق " + recommendation.score}>
          <div className="h-full rounded-full bg-gold" style={{ width: recommendation.score + "%" }} />
        </div>

        {recommendation.reasons.length ? (
          <div>
            <p className="mb-2 text-xs font-bold text-forest">چرا پیشنهاد شده؟</p>
            <ul className="space-y-2">
              {recommendation.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm leading-6 text-muted">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {recommendation.verifiedFacts.length ? (
          <div className="rounded-2xl bg-paper p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-forest">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              اطلاعات تأییدشده دانشنامه
            </p>
            <ul className="space-y-1.5">
              {recommendation.verifiedFacts.map((fact) => (
                <li key={fact} className="text-xs leading-6 text-muted">{fact}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {recommendation.evidenceLevels.length ? (
          <p className="text-xs leading-6 text-muted">
            سطح شواهد ثبت‌شده: {recommendation.evidenceLevels.join("، ")}
          </p>
        ) : null}

        {recommendation.safetyWarnings.length ? (
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-950">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              نکته ایمنی تأییدشده
            </p>
            {recommendation.safetyWarnings.map((warning) => (
              <p key={warning} className="text-xs leading-6 text-amber-950">{warning}</p>
            ))}
          </div>
        ) : null}

        {recommendation.scoreBreakdown.length ? (
          <details className="rounded-2xl border border-line px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-forest">جزئیات محاسبه امتیاز</summary>
            <ul className="mt-3 space-y-2">
              {recommendation.scoreBreakdown.map((factor) => (
                <li key={factor.label} className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{factor.label}</span>
                  <span className="tabular-nums">{factor.matchedCount.toLocaleString("fa-IR")} از {factor.selectedCount.toLocaleString("fa-IR")} · {factor.points.toLocaleString("fa-IR")} امتیاز از وزن {factor.weight.toLocaleString("fa-IR")}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-muted">{commerceLabel}</span>
          {recommendation.commerce.productHref ? (
            <a
              href={recommendation.commerce.productHref}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest/90"
            >
              {recommendation.commerce.availability === "available" ? "مشاهده و خرید" : "مشاهده محصول"}
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
        {recommendation.commerce.availability !== "available" ? (
          <p className="text-[11px] leading-5 text-muted">وضعیت فروش یا موجودی، در انتخاب و رتبه این روغن هیچ اثری نداشته است.</p>
        ) : null}
      </div>
    </article>
  );
}

function ResultPanel({
  result,
  onEdit,
  onReset,
}: {
  result: OilGuideRecommendationResult;
  onEdit: () => void;
  onReset: () => void;
}) {
  if (result.status !== "ready" || result.state === "unavailable") {
    return (
      <div className="rounded-3xl border border-amber-300/70 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
        منبع دانشنامه در دسترس نیست؛ برای جلوگیری از پیشنهاد بدون پشتوانه، نتیجه‌ای نمایش داده نشد.
        <button type="button" onClick={onEdit} className="mt-4 block font-semibold underline underline-offset-4">بازگشت به پاسخ‌ها</button>
      </div>
    );
  }
  if (result.state === "invalid_answers") {
    return (
      <div className="rounded-3xl border border-line bg-white p-6 text-sm leading-7 text-muted">
        بعضی از انتخاب‌ها دیگر معتبر نیستند. لطفاً پاسخ‌ها را بررسی و دوباره انتخاب کنید.
        <button type="button" onClick={onEdit} className="mt-4 block font-semibold text-forest underline underline-offset-4">ویرایش پاسخ‌ها</button>
      </div>
    );
  }
  if (result.state === "insufficient_approved_data") {
    return (
      <div className="rounded-3xl border border-amber-300/70 bg-amber-50 p-6">
        <h3 className="font-bold text-amber-950">هنوز سه پیشنهاد قابل اتکا وجود ندارد</h3>
        <p className="mt-2 text-sm leading-7 text-amber-950">
          از {result.totalCanonicalOils.toLocaleString("fa-IR")} روغن موجود در مجموعه کاندیداها، فعلاً {result.eligibleOilCount.toLocaleString("fa-IR")} روغن شرایط تأییدشده پیشنهاددهی را دارند.
          تا تکمیل بررسی انسانی اطلاعات و ایمنی، پیشنهاد ناقص یا ساختگی نمایش داده نمی‌شود.
        </p>
        <button type="button" onClick={onEdit} className="mt-4 rounded-xl border border-amber-900/20 px-4 py-2 text-sm font-semibold text-amber-950">ویرایش پاسخ‌ها</button>
      </div>
    );
  }
  if (result.state === "no_match") {
    return (
      <div className="rounded-3xl border border-line bg-white p-6">
        <h3 className="font-bold text-forest">برای این ترکیب انتخاب، سه تطابق معتبر پیدا نشد</h3>
        <p className="mt-2 text-sm leading-7 text-muted">می‌توانید پاسخ‌ها را تغییر دهید. امتیاز پایین یا نبود اطلاعات به‌عنوان تطابق مثبت در نظر گرفته نمی‌شود.</p>
        <button type="button" onClick={onEdit} className="mt-4 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white">ویرایش پاسخ‌ها</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-forest p-5 text-white md:p-6">
        <p className="text-xs font-bold text-gold">نتیجه راهنمای روغن شاهو</p>
        <h2 className="mt-2 text-2xl font-bold">سه پیشنهاد بر اساس انتخاب‌های شما</h2>
        <p className="mt-2 text-sm leading-7 text-white/75">
          این رتبه‌بندی از اطلاعات ساختاریافته و تأییدشده ساخته شده است. امتیاز، میزان تطابق با پاسخ‌های شماست؛ نه درصد اثربخشی پزشکی یا احتمال موفقیت.
        </p>
      </div>
      <div className="grid gap-4">
        {result.recommendations.map((recommendation, index) => (
          <RecommendationCard key={recommendation.oilId} recommendation={recommendation} rank={index + 1} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-forest">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          ویرایش پاسخ‌ها
        </button>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-forest">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          شروع دوباره
        </button>
      </div>
    </div>
  );
}

export function OilGuideQuestionnaire({ initialData }: { initialData: InitialData }) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [texture, setTexture] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OilGuideRecommendationResult | null>(null);

  const { areas, categories, concerns, totalCanonicalOils, eligibleOilCount, textureOptions } = initialData.data;
  const visibleCategories = useMemo(
    () => categories.filter((category) => selectedAreas.includes(category.areaSlug)),
    [categories, selectedAreas],
  );
  const visibleConcerns = useMemo(
    () => concerns.filter((concern) => selectedCategories.includes(concern.categoryId)),
    [concerns, selectedCategories],
  );
  const steps = useMemo<Step[]>(() => [
    { key: "area", label: "ناحیه" },
    { key: "category", label: "دسته" },
    ...(concerns.length ? [{ key: "concern" as const, label: "موضوع" }] : []),
    ...(textureOptions.length ? [{ key: "texture" as const, label: "بافت" }] : []),
  ], [concerns.length, textureOptions.length]);
  const currentStep = steps[stepIndex]?.key ?? "area";
  const readyForQuestionnaire = initialData.status === "ready" && areas.length > 0 && categories.length > 0;

  function toggleArea(slug: string) {
    const nextAreas = toggleValue(selectedAreas, slug);
    const nextCategoryIds = selectedCategories.filter((id) =>
      categories.some((category) => category.id === id && nextAreas.includes(category.areaSlug)),
    );
    setSelectedAreas(nextAreas);
    setSelectedCategories(nextCategoryIds);
    setSelectedConcerns((current) => current.filter((id) =>
      concerns.some((concern) => concern.id === id && nextCategoryIds.includes(concern.categoryId)),
    ));
  }

  function toggleCategory(id: string) {
    const nextCategories = toggleValue(selectedCategories, id);
    setSelectedCategories(nextCategories);
    setSelectedConcerns((current) => current.filter((concernId) =>
      concerns.some((concern) => concern.id === concernId && nextCategories.includes(concern.categoryId)),
    ));
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (currentStep === "area" && selectedAreas.length === 0) return;
    if (currentStep === "category" && selectedCategories.length === 0) return;
    if (stepIndex < steps.length - 1) setStepIndex((current) => current + 1);
    else void submit();
  }

  async function submit() {
    if (pending || selectedAreas.length === 0 || selectedCategories.length === 0) return;
    setPending(true);
    setResult(null);
    try {
      const response = await submitOilGuideAnswers({
        data: {
          areaSlugs: selectedAreas,
          categoryIds: selectedCategories,
          concernIds: selectedConcerns,
          texture,
        },
      });
      setResult(response);
    } catch {
      setResult({
        status: "unavailable",
        state: "unavailable",
        totalCanonicalOils: totalCanonicalOils,
        eligibleOilCount: eligibleOilCount,
        recommendations: [],
      });
    } finally {
      setPending(false);
    }
  }

  function editAnswers() {
    setResult(null);
    setStepIndex(Math.max(0, steps.length - 1));
  }

  function reset() {
    setSelectedAreas([]);
    setSelectedCategories([]);
    setSelectedConcerns([]);
    setTexture("");
    setStepIndex(0);
    setResult(null);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:space-y-8 md:py-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-forest px-5 py-8 text-white md:px-10 md:py-12">
        <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -left-5 -top-10 h-40 w-40 rounded-full border border-white/10" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gold">
            <Leaf className="h-4 w-4" aria-hidden="true" />
            SHAHOO · OIL GUIDE
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">روغن مناسب انتخاب‌های شما، نه صرفاً روغن موجود در فروشگاه</h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
            چند پرسش کوتاه را پاسخ دهید تا اطلاعات تأییدشده دانشنامه بر اساس ناحیه، دسته و موضوع انتخابی شما بررسی و سه گزینه قابل مقایسه رتبه‌بندی شود.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
            <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
            پیشنهادها فقط از داده‌های تأییدشده ساخته می‌شوند
          </div>
        </div>
      </section>

      {initialData.status !== "ready" ? (
        <SourceState status={initialData.status} />
      ) : (
        <>
          <ReadinessNotice total={totalCanonicalOils} eligible={eligibleOilCount} />
          {!readyForQuestionnaire ? (
            <div className="rounded-3xl border border-line bg-white p-6">
              <h2 className="font-bold text-forest">گزینه‌های پرسش‌نامه هنوز آماده نیستند</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                دسته‌ها و ناحیه‌های قابل استفاده باید از منبع دانشنامه خوانده شوند. هیچ گزینه‌ای به‌صورت دستی یا حدسی به پرسش‌نامه اضافه نشده است.
              </p>
            </div>
          ) : result ? (
            <ResultPanel result={result} onEdit={editAnswers} onReset={reset} />
          ) : (
            <section className="rounded-[2rem] border border-line bg-white p-5 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gold">پرسش‌نامه مرحله‌ای</p>
                  <h2 className="mt-1 text-xl font-bold text-forest">برای شروع، انتخاب‌های خود را مشخص کنید</h2>
                </div>
                <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-forest">
                  مرحله {((stepIndex + 1).toLocaleString("fa-IR"))} از {steps.length.toLocaleString("fa-IR")}
                </span>
              </div>

              <div className="mt-5 flex gap-1.5" aria-label="پیشرفت پرسش‌نامه">
                {steps.map((step, index) => (
                  <div key={step.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream">
                    <div className={["h-full rounded-full transition-all", index <= stepIndex ? "bg-gold" : "bg-transparent"].join(" ")} />
                  </div>
                ))}
              </div>
              <div className="mt-7">
                {currentStep === "area" ? (
                  <>
                    <h3 className="text-lg font-bold text-forest">کدام ناحیه برای شما مهم است؟</h3>
                    <p className="mt-1 text-sm text-muted">می‌توانید بیش از یک گزینه انتخاب کنید.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {areas.map((area: QuestionnaireArea) => (
                        <ChoiceButton
                          key={area.id}
                          selected={selectedAreas.includes(area.slug)}
                          title={area.nameFa}
                          subtitle={area.nameEn}
                          onClick={() => toggleArea(area.slug)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {currentStep === "category" ? (
                  <>
                    <h3 className="text-lg font-bold text-forest">کدام دسته به انتخاب شما نزدیک‌تر است؟</h3>
                    <p className="mt-1 text-sm text-muted">فقط دسته‌های مرتبط با ناحیه‌های انتخاب‌شده نمایش داده می‌شوند.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {visibleCategories.map((category: QuestionnaireCategory) => (
                        <ChoiceButton
                          key={category.id}
                          selected={selectedCategories.includes(category.id)}
                          title={category.nameFa}
                          subtitle={category.nameEn}
                          onClick={() => toggleCategory(category.id)}
                        />
                      ))}
                    </div>
                    {!visibleCategories.length ? <p className="mt-4 rounded-xl bg-paper p-4 text-sm text-muted">برای ناحیه انتخاب‌شده دسته قابل انتخابی ثبت نشده است.</p> : null}
                  </>
                ) : null}

                {currentStep === "concern" ? (
                  <>
                    <h3 className="text-lg font-bold text-forest">چه موضوعی برای شما اولویت دارد؟</h3>
                    <p className="mt-1 text-sm text-muted">انتخاب موضوع اختیاری است؛ فقط موضوعاتی نمایش داده می‌شوند که برای پرسش‌نامه تأیید شده‌اند.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {visibleConcerns.map((concern: QuestionnaireConcern) => (
                        <ChoiceButton
                          key={concern.id}
                          selected={selectedConcerns.includes(concern.id)}
                          title={concern.nameFa}
                          subtitle={concern.nameEn}
                          onClick={() => setSelectedConcerns((current) => toggleValue(current, concern.id))}
                        />
                      ))}
                    </div>
                    {!visibleConcerns.length ? <p className="mt-4 rounded-xl bg-paper p-4 text-sm text-muted">برای این دسته هنوز موضوع تأییدشده‌ای جهت انتخاب وجود ندارد. می‌توانید بدون انتخاب موضوع ادامه دهید.</p> : null}
                  </>
                ) : null}

                {currentStep === "texture" ? (
                  <>
                    <h3 className="text-lg font-bold text-forest">چه بافتی را ترجیح می‌دهید؟</h3>
                    <p className="mt-1 text-sm text-muted">این پرسش اختیاری است و گزینه‌ها از ویژگی‌های تأییدشده روغن‌ها استخراج شده‌اند.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {textureOptions.map((option) => (
                        <ChoiceButton
                          key={option}
                          selected={texture === option}
                          title={option}
                          onClick={() => setTexture((current) => current === option ? "" : option)}
                        />
                      ))}
                      <ChoiceButton
                        selected={!texture}
                        title="ترجیح خاصی ندارم"
                        onClick={() => setTexture("")}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={stepIndex === 0 || pending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-forest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  قبلی
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={pending || (currentStep === "area" && selectedAreas.length === 0) || (currentStep === "category" && selectedCategories.length === 0)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : stepIndex === steps.length - 1 ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                  {pending ? "در حال بررسی..." : stepIndex === steps.length - 1 ? "دریافت سه پیشنهاد" : "ادامه"}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-gold">بخش تکمیلی</p>
            <h2 className="mt-1 text-lg font-bold text-forest">می‌خواهید دانشنامه را خودتان مرور کنید؟</h2>
            <p className="mt-1 text-sm leading-7 text-muted">جستجو و مرور موضوعی، مسیرهای جداگانه‌ای از پیشنهاد شخصی هستند.</p>
          </div>
          <a href="/oil-guide/search" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-forest">
            جستجو در دانشنامه
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  );
}
