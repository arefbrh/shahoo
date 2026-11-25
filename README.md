<div align="center" dir="rtl">
  <img src="public/assets/brand/shahoo-logo-primary.webp" alt="نشان شاهو" width="200">
  <h1>شاهو · SHAHOO</h1>
  <p>فروشگاه فارسی و راست‌چین محصولات طبیعی و ارگانیک</p>
  <p>
    <a href="#شروع-سریع">شروع سریع</a> ·
    <a href="#مستندات">مستندات</a> ·
    <a href="https://github.com/shahoo-workspace/shahoo/issues">پیگیری کارها</a>
  </p>
</div>

## امکانات

| بخش | امکانات |
| --- | --- |
| فروشگاه | کاتالوگ و صفحهٔ محصول، سبد خرید، تسویهٔ مهمان و پیگیری سفارش |
| مدیریت | کاتالوگ، محتوا و رسانه، سفارش‌ها، بسته‌بندی، موجودی و گزارش‌ها |
| عملیات | PostgreSQL، بررسی سلامت برنامه، نگه‌داری موجودی، پشتیبان‌گیری و بازیابی |

قیمت‌ها در دیتابیس به ریال و به‌صورت عدد صحیح ثبت می‌شوند و فروشگاه آن‌ها را به تومان نمایش می‌دهد.

## شروع سریع

به Node.js نسخهٔ ۲۲، npm و Git نیاز دارید.

```sh
git clone https://github.com/shahoo-workspace/shahoo.git
cd shahoo
npm ci
npm run dev
```

نشانی محلی فروشگاه `http://localhost:8080` است. برای اجرای محلی با دادهٔ نمونه، `DATABASE_URL` را تنظیم نکنید تا برنامه از PGlite استفاده کند. برای تنظیمات دلخواه، الگوی محیط توسعه را ببینید. [.env.example](.env.example)

| فرمان | کاربرد |
| --- | --- |
| `npm run typecheck` | بررسی نوع‌ها |
| `npm run lint` | بررسی قواعد کد |
| `npm run test:project` | اجرای آزمون‌های پروژه |
| `npm run build` | ساخت نسخهٔ Vercel |
| `npm run build:self-hosted` | ساخت سرور مستقل Node.js |

## معماری

React و TanStack Start مسیرهای فروشگاه و پنل را اجرا می‌کنند. Nitro خروجی Vercel و سرور مستقل را می‌سازد. Drizzle به PostgreSQL متصل می‌شود و فایل‌های SQL در `migrations/` نسخه‌بندی شده‌اند. [معماری خودمیزبان](docs/SELF_HOSTING_ARCHITECTURE.md)

| مسیر | محتوا |
| --- | --- |
| `src/routes/` و `src/components/` | مسیرها و رابط فروشگاه و مدیریت |
| `src/server/` | منطق سرور، دسترسی و مدل‌های داده |
| `migrations/` | تغییرات ترتیبی طرح PostgreSQL |
| `scripts/` و `.github/workflows/` | آزمون‌ها، CI و ابزارهای عملیاتی |
| `public/assets/brand/` | نشان رسمی و دارایی‌های برند |

## وضعیت انتشار

نسخهٔ خودمیزبان در PR #11 وارد `main` شد. شواهد CI پیش از ادغام، وضعیت Preview و کارهای باقی‌مانده جداگانه ثبت شده‌اند. آخرین بررسی Neon، طرح Production را روی `0016` و Staging را روی `0019` نشان داد. آزمون‌های تکمیلی در یک PR جداگانه آمادهٔ بازبینی‌اند. [گزارش ادغام](docs/PROJECT_STATUS.md) · [PR آزمون‌ها](https://github.com/shahoo-workspace/shahoo/pull/12)

## مستندات

| موضوع | پیوند |
| --- | --- |
| وضعیت جاری و انتقال کار | [Project handoff](PROJECT_HANDOFF.md) |
| نتیجه و دامنهٔ آزمون‌ها | [گزارش آزمون](TEST_REPORT.md) |
| کارهای باقی‌مانده | [فهرست موارد باز](REMAINING_ISSUES.md) · [GitHub Issues](https://github.com/shahoo-workspace/shahoo/issues) |
| انتشار، پشتیبان‌گیری و بازگشت | [Production](docs/PRODUCTION.md) · [Backup & restore](docs/BACKUP_RESTORE_RUNBOOK.md) |
| راه‌اندازی سرور | [VPS](docs/VPS_DEPLOYMENT.md) · [Windows Server](docs/WINDOWS_SERVER_DEPLOYMENT.md) |
| مشارکت و مستندات کامل | [راهنمای مشارکت](CONTRIBUTING.md) · [نقشهٔ مستندات](docs/README.md) · [تاریخچهٔ تغییرات](CHANGELOG.md) |
