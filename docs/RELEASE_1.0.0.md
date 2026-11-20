# SHAHOO 1.0.0 — وضعیت انتشار Batch 09 remediation

**تصمیم: NOT READY FOR RELEASE — تأیید نهایی صادر نشده است.** Revision 02 آخرین مرحله اصلی اصلاح بود؛ Revision 02.1 تطبیق مستندات و شواهد و یک اصلاح محدود auth را انجام می‌دهد. Batch 09 remediation انجام شده است اما تأیید انتشار نیست. هیچ میزبان نهایی انتخاب یا خریداری نشده و هیچ سازگاری استقراری اثبات نشده است. هیچ SMS.ir، PayPing، پرداخت یا OTP واقعی، API حمل، object storage یا میزبانی تولیدی در این مرحله متصل نشده است.

**امنیت credential:** در archive ورودی یک secret مشترک OAuth برای پیش‌نمایش داخل سورس بود؛ در خروجی حذف شد و OAuth اختیاری بدون secret تزریق‌شده پیکربندی نمی‌شود. مالک credential باید افشای نسخه‌های قبلی را بررسی و rotate/revoke کند؛ این عملیات انجام نشده است. حساب سفارشی مشتری/مدیر مستقل است.

## آنچه پیاده شده است، نه لزوماً تأییدشده روی محیط تولید

- فروشگاه فارسی RTL، کاتالوگ، جستجو، CMS، صفحه اصلی، مقالات، سبد و ثبت سفارش پرداخت‌نشده، حساب مشتری مبتنی بر OTP/session سفارشی، نشانی، علاقه‌مندی، پشتیبانی و میز مدیریت با نقش/مجوز. حمل و رهگیری دستی است.
- قوانین قیمت، موجودی، نگهداری موجودی و گردش سفارش/پرداخت در سمت سرور؛ واحد ذخیره‌سازی ریال صحیح و نمایش تومان است. سرویس تأیید پرداخت داخلی و ثبت دفتری استرداد وجود دارند، اما صندوق به درگاه زنده وصل نیست و ثبت دفتری به معنی واریز یا استرداد بانکی نیست.
- `quoteCartWithDb` از قواعد مشترک فروش‌پذیری شامل حذف نرم variant، محصول و category استفاده می‌کند؛ آزمون مسیر دیتابیس آن از PGlite استفاده می‌کند. با وجود این، یک شکاف دیگر در مسیرهای checkout و بازیابی پرداخت دیرهنگام در بخش «مسائل باز» ثبت شده است؛ نباید کل زنجیره را یکسان و تأییدشده معرفی کرد.
- اصلاح محدود Revision 02.1: دو مسیر مستقیم server/gate قبلاً قبل از بررسی پرچم auth مقدار را trim می‌کردند؛ اکنون مقدار خام را با `true` دقیق می‌سنجند. آزمون‌های regression برای مقادیر دارای whitespace و import مستقیم server اضافه شده‌اند. نتیجه اجرای جدید را از شواهد ثبت‌شده نهایی بگیرید؛ پیکربندی build/runtime میزبان هنوز باید مستقلاً بررسی شود.
- seed نمایشی فقط در non-production و با opt-in، با حفظ انواع ازپیش‌موجود بخش‌های صفحه اصلی؛ seed پایه بدون داده کسب‌وکار نمونه. پوشش فعلی به معنی اثبات همزمانی seed روی PostgreSQL نیست.
- CSP بدون `unsafe-eval` در production اما با `unsafe-inline`، و هدرهای امنیتی؛ کوکی سفارشی `HttpOnly` و `SameSite=Lax` است و در production `Secure` می‌شود. اجرای واقعی از پشت proxy/HTTPS نیاز به تأیید دارد.
- CMS در مسیر تأییدشده رسانه را به‌صورت URL امن HTTPS و متن جایگزین ثبت می‌کند. کد آپلود محلی قدیمی وجود دارد، اما پایداری آن، بکاپ رسانه و cloud storage تأیید یا متصل نشده‌اند.

## شواهد آزمون — گزارش قبلی، نه اجرای تازه در این سند

جدول زیر عین وضعیت گزارش **Revision 02** مورخ 2026-11-19 است. این بازنویسی به‌تنهایی هیچ دستور را بازاجرا یا PostgreSQL را تأیید نمی‌کند؛ نتایج Revision 02.1 فقط با ثبت جداگانه دستور، محیط و خروجی واقعی قابل افزودن هستند. همه موارد زیر در تصمیم انتشار مؤثرند؛ موارد unexecuted/partial همچنان نیازمند بررسی مالک‌اند.

| دسته | فرمان / روش | نتیجه تاریخی Revision 02 | اجرای جدید در تهیه این راهنما | نیاز / محدودیت انتشار |
|---|---|---|---|---|
| نصب | `npm ci` | PASS | ثبت نشده | Node/npm سازگار، registry و lockfile؛ بازاجرا در محیط انتشار. |
| dependency audit | `npm audit --json`؛ در صورت نیاز `npm audit` | JSON: صفر advisory | ثبت نشده | شبکه/registry و بررسی تازه لازم است؛ نسخه ثابت `better-auth` در manifest `1.7.26` و `typescript-eslint` با بازه `^8.73.0` است، نه ضمانت عدم advisory امروز. |
| TypeScript | `npm run typecheck` | PASS | ثبت نشده | محیط Node و dependencies. |
| lint | `npm run lint` | ۰ خطا، ۵ هشدار موجود | ثبت نشده | بازاجرا و بررسی هشدارها. |
| build | `npm run build` | PASS؛ migration اجرا نمی‌کند | ثبت نشده | پرچم build، dependencies و بررسی artifact/preset و میزبان ضروری است. |
| script/platform | `node --test 'scripts/**/*.test.mjs'`؛ همچنین گروه نخست `npm test` | ۲۱۲/۲۱۶؛ ۴ شکست private harness | ثبت نشده | نه green کامل: `.grok/skills/og/SKILL.md` و `.grok/skills/og/references` در archive در دسترس نیستند. اجرا با همان فایل‌های مجاز در محیط پلتفرم؛ تست حذف یا تضعیف نشود. |
| application | گروه دوم دستور دقیق `npm test` در `package.json` | ۲۱۵/۲۱۵ | ثبت نشده | پوشش application/unit است؛ اثبات PostgreSQL یا E2E نیست. |
| database / PGlite | گروه سوم دستور دقیق `npm test` در `package.json` | ۹۴/۹۴ | ثبت نشده | PGlite و منطق تک‌اتصال؛ اثبات قفل و تراکنش واقعی PostgreSQL نیست. |
| auth configuration | `node --test scripts/with-app-env.test.mjs scripts/check-auth-invariant.test.mjs` | ۲۴/۲۴ | ثبت نشده | portable wrapper/invariant؛ مقایسه dev با build بعدی، نه محیط نهایی. |
| gate identity | تست `src/lib/auth/gate-identity.test.ts` در گروه دوم `npm test`؛ دستور مستقل دقیق در گزارش قبلی ثبت نشده | ۲۵/۲۵ | ثبت نشده | پلتفرم خصوصی/production را جایگزین نمی‌کند. |
| auth invariant | `npm run check:auth -- --dev-url http://127.0.0.1:8080` | dev و build بعدی: sign-in off | ثبت نشده | dev server در همان URL لازم است؛ bundle یا runtime هدف مستقیماً بررسی نمی‌شود. |
| browser smoke | مرور مستقیم Chromium روی 1280×800 و 390×844؛ فرمان دقیق در گزارش قبلی ثبت نشده | صفحه اصلی HTTP 200، بدون خطای console/page یا overflow | ثبت نشده | فقط smoke محدود؛ اسکریپت `scripts/browser-smoke.mjs` در آن sandbox به علت نبود Playwright headless-shell اجرا نشد، به‌جای آن از Chromium سیستم استفاده شد. |
| browser E2E | فرمان و harness کامل در گزارش قبلی ثبت نشده | NOT EXECUTED | ثبت نشده | سناریوهای کاربر/مدیر، پرداخت و مجوزها باید در محیط مجاز ایجاد/اجرا شوند. |
| accessibility | workflow کامل ثبت نشده | NOT EXECUTED | ثبت نشده | ممیزی خودکار و دستی صفحه‌کلید، screen reader و موبایل لازم است. |
| PostgreSQL واقعی | `npm run db:migrate` و checklist [POSTGRESQL_VERIFICATION.md](POSTGRESQL_VERIFICATION.md) | NOT EXECUTED | ثبت نشده | نصب/سرور PostgreSQL ایزوله؛ برای تجارت real-PG harness لازم است. |
| پشتیبان/بازیابی | `pg_dump`, `createdb`, `pg_restore`, `psql` طبق checklist | NOT EXECUTED | ثبت نشده | محیط disposable و سپس کپی staging مجاز، با ثبت مقایسه و بازیابی رسانه. |
| target host | هنوز انتخاب نشده | NOT EXECUTED | ثبت نشده | سازگاری، start، TLS، cookies، proxy و نسخه‌ها باید بعد از انتخاب و تأیید مالک بررسی شود. |

آزمون‌های portable مربوط به برنامه، نظیر `scripts/with-app-env.test.mjs`، `scripts/check-auth-invariant.test.mjs` و `src/lib/auth/gate-identity.test.ts`، بخشی از منطق wrapper/auth را پوشش می‌دهند، اما محتوای private OG skill و contract پلتفرم را بازتولید نمی‌کنند. گزارش‌های قبلی نیاز به `.grok/app-env.json` را در شکست‌های قدیمی‌تر مطرح کرده‌اند؛ چهار شکست Revision 02 به فایل skill و references مربوط بودند.

## مسائل باز و نیازمند تأیید پیش از انتشار

1. **PostgreSQL واقعی و concurrency:** fresh و upgrade migration، FK، transaction و سناریوهای تجارت، به‌ویژه inventory و callbackهای همزمان هنوز اجرا نشده‌اند. صرف `DATABASE_URL` روی تست‌های PGlite آنها را به PostgreSQL تبدیل نمی‌کند. یک اسکریپت موجود `scripts/pg-media-race.sh` صرفاً race رسانه را در SQL تقلید می‌کند، نه اجرای TypeScript یا آزمون تجارت، و فقط migrationهای 0002–0008 را خودش می‌زند.
2. **پشتیبان/بازیابی و میزبان:** دستور آماده‌شده به معنای PASS نیست. امنیت، نسخه ابزار، اعتبار پشتیبان، بازیابی DB و رسانه، runtime و build-time config پس از انتخاب میزبان بررسی شود.
3. **Sellability در checkout/late recovery — نگرانی منبع، نیازمند آزمون/رفع:** `src/server/commerce/checkout.ts` و `src/server/payments/service.ts` در queryهای مربوط، `productVariants.deletedAt` را به `isLineSellable` نمی‌دهند، در حالی که quote و cart این مقدار را می‌دهند و rule آن را بررسی می‌کند. بنابراین برای variant با `status='active'` و `deleted_at` غیرتهی، سازگاری کل مسیر را نمی‌توان تأیید کرد؛ تست regression و بررسی شرایط رسیدن به این حالت لازم است. این نتیجه، رد شدن اصلاح مشخص `quoteCart` نیست.
4. **Auth flag — تأیید محیط هدف باز است:** تفاوت trim در مسیر مستقیم server/gate در Revision 02.1 اصلاح شده است؛ regression اضافه شده اما نتیجه نهایی اجرای جدید باید جداگانه ثبت شود. مقدار `false` را در build و runtime صریح تنظیم و رفتار واقعی میزبان را تأیید کنید؛ بررسی محلی جای تأیید deployment را نمی‌گیرد.
5. چهار شکست private platform harness، browser E2E کامل، accessibility و بازاجرای آزمون‌ها/audit در محیط انتشار باز مانده‌اند. smoke تاریخی جای آنها را نمی‌گیرد.
6. طبق گزارش Revision 02، توضیح کامل ۱۱ یافته MEDIUM و ۶ یافته LOW از audit اصلی Claude در archive موجود نبود: **UNVERIFIED — ORIGINAL SOURCE MISSING**. محتوا اختراع یا بدون سند resolved نشود. از مالک اصل گزارش خواسته شود.
7. OTP/SMS واقعی، پرداخت واقعی، امنیت عملیاتی، محدودسازی درخواست و نقش‌ها در topology نهایی و رسیدگی به تأخیر پرداخت باید قبل از هر بهره‌برداری واقعی بررسی و در مرحله مجاز بعدی تصویب شوند. انقضای hold در کد هنگام برخی خواندن‌های cart/order بررسی می‌شود، نه به‌عنوان scheduler مستقل اثبات‌شده؛ برنامه عملیاتی و backlogs باید بررسی شوند.

## آینده و مرزها

زرین‌پال، زیبال و آیدی‌پی آداپتر قطع‌شده دارند؛ SMS live دارای مسیر کد مشروط است اما در این مرحله وصل یا آزمایش نشده؛ PayPing، حمل خودکار و ذخیره ابری نیز متصل نیستند. اتصال هر سرویس یا انتخاب hosting فقط پس از تصمیم و مجوز صریح مالک و آغاز مرحله مربوطه است. روش مهاجرت و environment در [PRODUCTION.md](PRODUCTION.md) و روش disposable PostgreSQL و backup/restore در [POSTGRESQL_VERIFICATION.md](POSTGRESQL_VERIFICATION.md) آمده است.

## Batch 09 remediation status — 2026-11-19

Batch 09 source remediation adds durable PayPing attempts, callback verification, safe Already Verified handling, and reconciliation persistence. This is not production approval. Official amount-unit confirmation, authorized sandbox verification, real PostgreSQL concurrency evidence, full fresh test evidence, and owner disposition of unresolved OTP policy are still required.

## Batch 09 comprehensive audit release note — 2026-11-20

This source package is **READY WITH DOCUMENTED LIMITATIONS** for controlled PayPing/SMS.ir provider configuration, not production activation. All provider credentials remain absent. See `BATCH_09_COMPREHENSIVE_AUDIT.md` and `docs/TEST_REPORT_BATCH_09.md` for the independent audit, issue statuses, exact counts, blocked private tests, and remaining external verification.

## Batch 09 final corrective addendum — 2026-11-20

The final corrective pass resolves the PayPing verification-uncertainty and OTP older-challenge defects in source. It does not claim live provider connectivity, approved merchant configuration, real PostgreSQL concurrency, or production deployment. See `BATCH09-FINAL-REMEDIATION-REPORT.md`, `BATCH09-FINAL-TEST-REPORT.md`, and `BATCH09-FINAL-ISSUE-REGISTER.md`. Verdict: **READY WITH DOCUMENTED LIMITATIONS** for controlled provider sandbox configuration only.
