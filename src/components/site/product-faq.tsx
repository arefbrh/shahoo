import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { panelClass } from "./ui";

interface FaqItem {
  q: string;
  a: string;
}

const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "نحوه تشخیص اصالت و خلوص ۱۰۰٪ روغن‌ها و محصولات شاهو چیست؟",
    a: "تمامی روغن‌های خوراکی و درمانی شاهو حاصل پرس سرد (Cold Pressed) دانه‌های دست‌چین و مرغوب هستند. در فرآیند تولید از هیچ‌گونه حرارت بالا، حلال شیمیایی، اسانس یا روغن پایه ارزان‌قیمت استفاده نمی‌شود و عطر و طعم طبیعی دانه کاملاً حفظ شده است.",
  },
  {
    q: "چرا در دمای خنک یا داخل یخچال روغن کدر شده یا ته‌نشینی لِرد دیده می‌شود؟",
    a: "بسته شدن یا رسوب جزئی ذرات طبیعی دانه (لِرد) در دمای پایین، نشانه طبیعی فیلتر نشدن شیمیایی و غنای اسیدهای چرب مفید محصول است. با قرار گرفتن در دمای معمولی اتاق (حدود ۲۰ الی ۲۵ درجه سانتی‌گراد)، بافت روغن مجدداً زلال می‌شود.",
  },
  {
    q: "بهترین شرایط برای نگهداری روغن‌ها و کره‌های آجیلی چیست؟",
    a: "توصیه می‌شود محصولات را در جای خشک، خنک و حتماً دور از تابش مستقیم نور خورشید و منابع حرارتی نگهداری فرمایید. درب بطری را پس از هر بار مصرف محکم ببندید تا از اکسیداسیون طبیعی جلوگیری شود.",
  },
  {
    q: "مدت ماندگاری بهینه محصولات چقدر است؟",
    a: "به دلیل تازه‌گیری مداوم و عدم استفاده از مواد نگهدارنده شیمیایی، بهترین زمان مصرف روغن‌ها بین ۱۲ تا ۱۸ ماه و برای کره‌های آجیلی خالص تا ۶ ماه پس از تاریخ تولید است.",
  },
  {
    q: "بسته‌بندی و ارسال به چه شکل انجام می‌شود تا شیشه‌ها نشکنند؟",
    a: "تمامی سفارش‌ها با ضربه‌گیرهای چندلایه بابل‌رپ و کارتن‌های مقاوم پستی بسته‌بندی می‌شوند و از طریق پست پیشتاز یا تیپاکس با کد رهگیری لحظه‌ای به سراسر کشور ارسال می‌گردند.",
  },
];

export function ProductFaq({ customFaqs }: { customFaqs?: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqs = customFaqs && customFaqs.length > 0 ? customFaqs : DEFAULT_FAQS;

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
            نکات مهم درباره نگهداری، طبع، مصرف و اصالت فرابکر محصولات طبیعی شاهو
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
