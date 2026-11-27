import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatTomanFromIrr } from "@/lib/format";
import type { OilRecommendationKnowledge } from "@/lib/store-types";
import { buttonGhost } from "./ui";

type Oil = {
  slug: string;
  name: string;
  subtitle: string;
  priceIrr: number;
  oilFinder: { intendedUse: string[]; texture: string; scent: string } | null;
  knowledge: OilRecommendationKnowledge | null;
};

const uses = [
  { id: "skin", label: "مراقبت پوست و ماساژ" },
  { id: "hair", label: "ساقه مو" },
  { id: "cooking", label: "سالاد و پخت ملایم" },
  { id: "general", label: "آشنایی کلی" },
];

export function OilGuide({ oils }: { oils: Oil[] }) {
  const [step, setStep] = useState(1);
  const [use, setUse] = useState("");
  const [texture, setTexture] = useState("");
  const [scent, setScent] = useState("");
  const ranked = useMemo(() => {
    return oils
      .map((oil) => {
        let score = 1;
        if (use && oil.oilFinder?.intendedUse.includes(use)) score += 3;
        if (texture && oil.oilFinder?.texture === texture) score += 2;
        if (scent && oil.oilFinder?.scent === scent) score += 2;
        return { oil, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [oils, scent, texture, use]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <header className="text-center">
        <p className="text-xs font-bold text-gold">راهنمای انتخاب</p>
        <h1 className="text-3xl font-bold text-forest">کدام روغن شاهو به کارتان می‌آید؟</h1>
        <p className="mt-2 text-sm text-muted">سه سؤال کوتاه. نتیجه نسخه پزشکی نیست.</p>
      </header>
      <div className="space-y-3 rounded-3xl border border-line bg-paper p-6">
        {step === 1 ? (
          <Choices
            title="هدف اصلی چیست؟"
            options={uses}
            onPick={(id) => {
              setUse(id);
              setStep(2);
            }}
          />
        ) : null}
        {step === 2 ? (
          <Choices
            title="چه بافتی را ترجیح می‌دهید؟"
            options={[
              { id: "light", label: "سبک" },
              { id: "rich", label: "غلیظ" },
            ]}
            onPick={(id) => {
              setTexture(id);
              setStep(3);
            }}
          />
        ) : null}
        {step === 3 ? (
          <Choices
            title="عطر؟"
            options={[
              { id: "mild", label: "ملایم" },
              { id: "herbal", label: "گیاهی" },
            ]}
            onPick={(id) => {
              setScent(id);
              setStep(4);
            }}
          />
        ) : null}
        {step === 4 ? (
          <div className="space-y-3">
            <h2 className="font-bold text-forest">نزدیک‌ترین روغن‌ها</h2>
            {ranked.map(({ oil }) => (
              <Link key={oil.slug} to="/product/$productId" params={{ productId: oil.slug }} className="block rounded-2xl bg-cream p-4">
                <p className="font-bold text-forest">{oil.name}</p>
                <p className="text-sm text-muted">{oil.subtitle}</p>
                <p className="mt-1 text-sm tabular-nums">{formatTomanFromIrr(oil.priceIrr)}</p>
                {oil.knowledge?.safetyWarning ? (
                  <p className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950">
                    هشدار ایمنی: {oil.knowledge.safetyWarning}
                  </p>
                ) : null}
                {oil.knowledge && (oil.knowledge.useFace || oil.knowledge.useBody || oil.knowledge.useMassage || oil.knowledge.useHairShaft || oil.knowledge.useScalp) ? (
                  <p className="mt-2 text-xs leading-6 text-muted">
                    اطلاعات تأییدشده دانشنامه: {[
                      oil.knowledge.useFace ? `پوست صورت: ${oil.knowledge.useFace}` : "",
                      oil.knowledge.useBody ? `پوست بدن: ${oil.knowledge.useBody}` : "",
                      oil.knowledge.useMassage ? `ماساژ: ${oil.knowledge.useMassage}` : "",
                      oil.knowledge.useHairShaft ? `ساقه مو: ${oil.knowledge.useHairShaft}` : "",
                      oil.knowledge.useScalp ? `پوست سر: ${oil.knowledge.useScalp}` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </Link>
            ))}
            <button
              type="button"
              className={buttonGhost}
              onClick={() => {
                setStep(1);
                setUse("");
                setTexture("");
                setScent("");
              }}
            >
              از نو
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Choices({
  title,
  options,
  onPick,
}: {
  title: string;
  options: Array<{ id: string; label: string }>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-bold text-forest">{title}</h2>
      {options.map((option) => (
        <button key={option.id} type="button" onClick={() => onPick(option.id)} className="block min-h-11 w-full rounded-2xl bg-cream px-4 text-start text-sm font-bold">
          {option.label}
        </button>
      ))}
    </div>
  );
}
