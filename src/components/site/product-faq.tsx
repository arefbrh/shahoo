import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { panelClass } from "./ui";

interface FaqItem {
  q: string;
  a: string;
}

export function ProductFaq({ customFaqs }: { customFaqs?: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqs = customFaqs ?? [];
  if (!faqs.length) return null;

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className={`${panelClass} p-6 sm:p-8`}>
        <div className="mb-6">
          <span className="text-xs font-bold text-gold">پاسخ به سوالات شما</span>
          <h2 className="mt-1 text-xl font-bold text-forest">پرسش‌های متداول خریداران</h2>
          <p className="mt-1 text-xs text-muted">
            راهنمای خرید و نگهداری محصولات شاهو
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border border-line/60 bg-paper/70 transition hover:border-gold/50"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-start text-sm font-bold text-forest transition"
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gold transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen ? (
                  <div className="border-t border-line/40 px-4 pb-4 pt-3 text-xs leading-7 text-ink/85">
                    <p className="whitespace-pre-line">{item.a}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
