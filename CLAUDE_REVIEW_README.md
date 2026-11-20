> **Revision 02.1 continuity notice (2026-11-19):** The content below is a historical snapshot, not current release or next-batch authorization. The latest completed remediation is Batch 08 Revision 02; current work is Batch 08 Revision 02.1. Release is **NOT READY FOR RELEASE**, final approval is pending, and Batch 09 has not started. For current evidence and actions, read `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md`, `REMAINING_ISSUES.md`, `BATCH_08_FINAL_RELEASE_EVIDENCE.md`, and `docs/PRODUCTION.md`. Historical “checkpoint” numbering is not authorization for Batch 09.

---

> **Updated 2026-11-18 (Batch 03 correction).** This README describes the original independent-review package. Current status: the project has since gone through Batch 00–03 and corrections. Start with `SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` and `LATEST_HANDOFF.md`; `AGENTS.md` is now the portable instruction file (the original is in `docs/archive/AGENTS.grok-platform-original.md`). `BATCH_08_PRODUCTION_REPORT.md` is historical. The original text follows unchanged.

---

# SHAHOO 1.0.0 — Independent Review Package

این بسته برای ممیزی مستقل سورس SHAHOO توسط Claude یا بازبین فنی دیگر آماده شده است.

## نقطه شروع بازبینی
1. ابتدا `AGENTS.md` و `PROJECT_HANDOVER.md` را بخوان.
2. سپس `docs/PRODUCTION.md`، `docs/RELEASE_1.0.0.md`، `DECISIONS.md` و `REMAINING_ISSUES.md` را بررسی کن.
3. گزارش اجرای تست‌ها در `TEST_REPORT.md` را صرفاً گزارش سازنده بدان؛ نتایج را مستقل بازتولید کن.
4. سورس واقعی در `src/`, `server/`, `scripts/`, `migrations/` و `public/` قرار دارد.
5. تصاویر `screenshots/` برای تطبیق UI با پیاده‌سازی ارائه شده‌اند.

## دستورالعمل ممیزی
- ابتدا فقط ممیزی کن؛ بدون اجازه مالک هیچ فایل یا معماری را تغییر نده.
- هر ادعا را با مسیر فایل، تابع/نماد و در صورت امکان شماره خط پشتیبانی کن.
- وجود Schema یا تست به‌تنهایی اثبات کامل بودن قابلیت نیست.
- لایه UI، API، احراز هویت، مجوز، دیتابیس، تراکنش و تست را جداگانه ارزیابی کن.
- مشکلات را بر اساس Critical / High / Medium / Low اولویت‌بندی کن.
- برای هر مشکل، سناریوی بازتولید، اثر، شواهد کد و راهکار کم‌ریسک ارائه کن.
- قابلیت سالم را پیشنهاد بازنویسی نده؛ اصل بر اصلاح حداقلی و حفظ معماری است.
- پرداخت واقعی، پیامک واقعی، حمل‌ونقل و فضای ابری در این نسخه متصل نیستند. بدون کلید و مجوز مالک هیچ تماس واقعی برقرار نکن.
- دیتابیس Neon واقعی در گزارش نسخه اجرا نشده است. اجرای Migration روی دیتابیس واقعی را مفروض نگیر.
- هشدار Better Auth و باقی‌ماندن `unsafe-inline` را مستقل بررسی کن.
- تست‌ها را در محیط ایزوله اجرا کن؛ به سرویس Production متصل نشو.

## نصب وابستگی‌ها و تست
```bash
npm ci
npx tsc --noEmit
npx eslint . --quiet
npm test
npm run build
```

ممکن است برخی تست‌ها یا Build به متغیرهای محیطی نیاز داشته باشند. عدم دسترسی به Neon یا سرویس‌های بیرونی را صریحاً گزارش کن و تست را موفق فرض نکن.

## محدودیت بسته
این بسته سورس کامل و اسناد/تصاویر بازبینی است. `node_modules` و خروجی‌های build در آن نیستند؛ این موارد باید در محیط بازبین ساخته شوند. هیچ Secret واقعی نباید به بسته افزوده شود.
