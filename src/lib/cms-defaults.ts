import type { FaqItemDraft, TrustMarkDraft } from "./cms-types";

export const DEFAULT_PRODUCT_FAQS: FaqItemDraft[] = [
  {
    id: "faq-1",
    q: "اطلاعات منشأ محصول را کجا ببینم؟",
    a: "منشأ اعلام‌شده را در مشخصات همان محصول بررسی کنید.",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "faq-2",
    q: "آیا این محصول برای مصرف خوراکی مناسب است؟",
    a: "نوع مصرف را از برچسب بسته و توضیحات همان کالا بررسی کنید.",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "faq-3",
    q: "مواد تشکیل‌دهنده را کجا ببینم؟",
    a: "پیش از خرید ترکیبات و هشدارهای حساسیت روی برچسب محصول را بررسی کنید.",
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "faq-4",
    q: "تاریخ مصرف محصول چیست؟",
    a: "تاریخ روی بسته و شرایط نگهداری اعلام‌شده برای همان کالا ملاک است.",
    isActive: true,
    sortOrder: 4,
  },
  {
    id: "faq-5",
    q: "روش ارسال چگونه مشخص می‌شود؟",
    a: "روش‌های فعال و هزینه هر روش در مرحله ثبت سفارش نمایش داده می‌شوند.",
    isActive: true,
    sortOrder: 5,
  },
];

export const DEFAULT_TRUST_MARKS: TrustMarkDraft[] = [
  {
    id: "mark-enamad",
    provider: "enamad",
    title: "نماد اعتماد الکترونیکی",
    description: "مرکز توسعه تجارت الکترونیکی وزارت صمت",
    status: "pending",
    sortOrder: 1,
  },
  {
    id: "mark-samandehi",
    provider: "samandehi",
    title: "ساماندهی پایگاه‌های اینترنتی",
    description: "مرکز فناوری اطلاعات و رسانه‌های دیجیتال وزارت ارشاد",
    status: "pending",
    sortOrder: 2,
  },
];
