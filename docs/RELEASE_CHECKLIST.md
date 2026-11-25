# چک‌لیست نهایی انتشار و بازگشایی فروشگاه شاهو (Release & Go-Live Checklist)

این چک‌لیست رسمی باید قبل از معرفی عمومی وب‌سایت `organicshahoo.ir` و شروع فروش تجاری توسط مالک و تیم فنی گام‌به‌گام بررسی و تیک زده شود.

---

## فاز ۱: زیرساخت، سرور و پایداری داده (Infrastructure Gates)

- [ ] **دیتابیس اصلی پروداکشن:** PostgreSQL 16 روی سرور مستقل راه‌اندازی شده و تمام مایگریشن‌ها تا `0019` بدون خطا اجرا شده‌اند.
- [ ] **عدم اتصال به دیتابیس تست:** متغیر `DATABASE_URL` به هیچ عنوان به دیتابیس‌های Preview یا دمو متصل نیست.
- [ ] **تست بکاپ‌گیری خودکار:** اسکریپت `backup-db.ps1` (یا نسخه لینوکس) یک فایل دامپ فشرده سالم تولید کرده و در تسک‌های زمان‌بندی‌شده ثبت شده است.
- [ ] **تست آزمایشی بازیابی (Restore Drill):** بازگردانی آخرین نسخه بکاپ روی یک دیتابیس آزمایشی با موفقیت تست شده است.
- [ ] **فضای دیسک و مانیتورینگ:** درایو سرور حداقل ۲۰ گیگابایت فضای خالی دارد و اسکریپت `monitor-health.ps1` در حال اجراست.
- [ ] **گواهی SSL امن:** گواهی HTTPS برای دامنه‌های `organicshahoo.ir` و `www.organicshahoo.ir` صادر و فعال است.

---

## فاز ۲: هویت بصری، محتوا و تنظیمات فروشگاه (Brand & Content Gates)

- [ ] **لوگوهای رسمی:** لوگوی اصلی با پس‌زمینه کرم در شل/هدر و لوگوی مینیمال در فاکتور بدون دفرمگی نمایش داده می‌شوند.
- [ ] **تنظیمات کانونیکال برند:** نام برند، شعار، شماره تماس پشتیبانی و نشانی فروشگاه در پنل مدیریت CMS ذخیره شده است.
- [ ] **صفحات قانونی و سیاست‌ها:** صفحه «درباره ما»، «تماس با ما»، «شرایط بازگرداندن کالا» و «حریم خصوصی» منتشر شده‌اند.
- [ ] **اطلاعات تماس فرستنده:** مشخصات کامل نشانی فرستنده، کد پستی و تلفن در بخش تنظیمات ارسال تکمیل شده است.

---

## فاز ۳: کاتالوگ، قیمت‌گذاری و انبارداری (Catalog & Inventory Gates)

- [ ] **واحد قیمت‌ها:** قیمت کالاها در دیتابیس به ریال ذخیره شده و در تمامی بخش‌های سایت به تومان با جداکننده سه رقمی و اعداد فارسی نمایش داده می‌شود.
- [ ] **موجودی انبار:** موجودی واقعی روغن‌های خالص، کره‌ها و محصولات گیاهی در پنل ثبت شده است.
- [ ] **تست انقضای رزرو سبد خرید:** در صورت انصراف کاربر، کالای نگه‌داشته شده حداکثر پس از ۱۵ دقیقه به موجودی انبار بازمی‌گردد.

---

## فاز ۴: اسناد چاپی و بسته‌بندی (Sales Documents & Fulfillment)

- [ ] **چاپ فاکتور رسمی:** فاکتور فروش برای سفارش با ۱ قلم و با بیش از ۱۰ قلم در مرورگر چاپ شده و صفحه‌بندی آن بدون برش متن تأیید شده است.
- [ ] **خروجی‌های فاکتور:** دانلود خروجی PNG و خروجی اکسل (XLSX) فاکتور تست شده و فرمول‌ها و مبالغ با سفارش همخوانی دارند.
- [ ] **برچسب پستی:** چاپ برچسب سیاه‌وسفید در اندازه ۱۰×۱۵ و A4 تست شده و شامل کد پستی فرستنده و گیرنده و آدرس سایت `organicshahoo.ir` بدون بارکد جعلی است.
- [ ] **حواله انبارداری:** ثبت تعداد اقلام جمع‌آوری‌شده (Picked) و نام بازبین در فرم انبارداری تست شده است.

---

## فاز ۵: درگاه پرداخت و امنیت (Payment & Security Gates)

- [ ] **اتصال درگاه پی‌پینگ:** اعتبارسنجی سروربه‌سرور فعال بوده و بازگشت تکراری (Duplicate Callback) بررسی شده است.
- [ ] **ارسال پیامک کد ورود (OTP):** کد تأیید در کمتر از ۱۰ ثانیه به شماره موبایل کاربر ارسال و لاگین انجام می‌شود.
- [ ] **کوکی‌های امن:** کوکی‌ها دارای فلگ `HttpOnly`، `Secure` و `SameSite=Lax` هستند.
- [ ] **عدم افشای سکرت‌ها:** هیچ کلید محرمانه یا رمزی در کد فرانت‌اند یا لاگ‌های عمومی وجود ندارد.

---

## فاز ۶: روز بازگشایی و سناریوی بازگشت (Go-Live & Rollback Plan)

### سناریوی سوییچ به پروداکشن (Cutover):
1. ثبت رکورد A دامنه `organicshahoo.ir` به آدرس آی‌پی عمومی سرور نهایی.
2. اجرای تست دود نهایی (خرید ۱ عدد محصول تستی، پرداخت ۱۰۰۰ تومانی، چاپ فاکتور و لغو سفارش).
3. صفر کردن سفارش‌های دمو و آماده‌سازی برای پذیرش مشتریان واقعی.

### سناریوی بازگشت اضطراری (Rollback Plan):
در صورت بروز قطعی پیش‌بینی‌نشده در سرور جدید:
1. تغییر سریع رکورد DNS دامنه به سرور پشتیبان یا محیط موقت Vercel.
2. مسدودسازی موقت ثبت سفارش با قرار دادن متغیر `MAINTENANCE_MODE=true`.
3. بررسی ریشه‌ای خطا از طریق فایل لاگ `logs/health-monitor.log` و `logs/service-stderr.log`.


## Self-hosted infrastructure gates — 2026-11-24

- [ ] `docker compose config` passes with a fresh, non-secret `.env`.
- [ ] Docker image builds with Nitro `node-server` preset.
- [ ] App container readiness endpoint passes against disposable PostgreSQL.
- [ ] Worker completes one cycle, times out safely when stalled, and restarts after failure.
- [ ] Caddy obtains and renews HTTPS certificates for the configured domain.
- [ ] Linux and Windows backup archives validate successfully.
- [ ] Full database and media restore drills pass on disposable infrastructure.
- [ ] Encrypted and off-site backups are configured and independently verified.
- [ ] WAL/PITR is configured and a point-in-time recovery drill passes, or the requirement is explicitly deferred by the owner.
- [ ] Monitoring checks app, database, worker, proxy, disk, backup freshness and alert delivery.
- [ ] PayPing and SMS.ir remain disabled until their separate provider checklists are signed off.
- [ ] Torob feed output is checked against the current provider contract before submission.
- [ ] CI, TypeScript, lint, all test groups, production build and browser/mobile checkout pass.
