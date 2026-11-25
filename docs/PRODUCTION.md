# راهنمای استقرار شاهو 1.0.0 — Batch 09 remediation

> **تصمیم فعلی: NOT READY FOR RELEASE.** Revision 02 آخرین مرحله اصلی اصلاح بود؛ Revision 02.1 تطبیق اسناد و شواهد و اصلاح محدود مقایسه مستقیم پرچم auth را انجام می‌دهد، نه تأیید انتشار. PostgreSQL واقعی، بازیابی نسخه پشتیبان، میزبان نهایی، E2E و دسترس‌پذیری کامل هنوز تأیید نشده‌اند. مالک هنوز میزبان انتخاب یا خریداری نکرده است. Batch 09 remediation انجام شده است؛ اتصال ارائه‌دهندگان زنده همچنان مجاز نیست. اعداد گزارش Revision 02 در [یادداشت انتشار](RELEASE_1.0.0.md) فقط شواهد تاریخی‌اند، نه نتیجه اجرای جدید.

## پیش‌نیازها و محدوده

- اجازه صریح مالک، انتخاب میزبان، دامنه، TLS، پشتیبان و طرح بازگشت؛ هیچ سازگاری با میزبان یا ارائه‌دهنده خاصی در این مرحله آزموده نشده است.
- Node.js سازگار با lockfile و قابلیت اجرای آزمون‌های TypeScript پروژه. گزارش تاریخی Batch 08 از Node `v22.23.4` استفاده کرده است؛ سازگاری و نسخه دقیق میزبان باید دوباره تأیید شوند. ابزارهای npm و ابزارهای PostgreSQL متناسب با نسخه سرور، اتصال امن و سطح دسترسی لازم برای مهاجرت و پشتیبان لازم‌اند.
- `npm ci` بر پایه `package-lock.json`، سپس `npm run typecheck`، `npm run lint`، `npm test` و `npm run build`. نتیجه تاریخی `npm test` کاملاً سبز نیست؛ برای جزئیات و وابستگی خصوصی به [RELEASE_1.0.0.md](RELEASE_1.0.0.md) مراجعه کنید.
- `npm run build` **مهاجرت اجرا نمی‌کند**. `package.json` اسکریپت عمومی `start` ندارد؛ `vite.config.ts` برای ساخت Nitro دارای `preset: "vercel"` است و `startup.sh` پیش‌نمایش توسعه را در `/workspace` اجرا می‌کند، نه سرویس تولیدی عمومی. پس command/artifact قابل اجرای تولید، سازگاری topology، متغیرها، راه‌اندازی مجدد و health check باید پس از انتخاب میزبان و با تأیید مالک بررسی شوند؛ یک دستور حدسی را به‌عنوان راه‌اندازی آزموده‌شده ارائه نکنید. هیچ تنظیم میزبان جدیدی در این مرحله اضافه نشده است.
- `npm run dev` برای preview است و `ALLOW_DEV_CSP=1 SEED_DEMO=1 ECHO_OTP=1` می‌گذارد؛ برای production از آن استفاده نکنید. PGlite در نبود `DATABASE_URL` فقط برای توسعه و آزمون غیرتولیدی است.

## متغیرهای محیط: الزام کد در برابر توصیه عملیاتی

مقادیر واقعی در secret manager/محیط امن میزبان باشند، نه در مخزن، فایل نمونه، فرمان، تاریخچه shell، لاگ، خروجی CI یا تصویر container. `.env.example` فهرست بدون مقدار واقعی است؛ برچسب «Required in production» آن را با الزام اجرایی زیر اشتباه نگیرید.

| متغیر | الزام واقعی و کاربرد |
|---|---|
| `NODE_ENV=production` | برای اعمال شاخه‌های امنیتی و داده تولید لازم است؛ تشخیص در کد با همین رشته دقیق انجام می‌شود. |
| `DATABASE_URL` | تنها نام بررسی‌شده اجباری در `validateProductionEnv` برای production و برای **هر** اجرای `db:migrate`؛ URL معتبر PostgreSQL. اتصال ناموفق به PGlite تبدیل نمی‌شود. در یک URL حاوی رمز، حفاظت از متغیر فرآیند و لاگ‌ها ضروری است؛ در روش محلی آزمون از فایل گذرواژه استفاده کنید. |
| `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1` | فقط هنگام اجرای صریح migration با `NODE_ENV=production` لازم است؛ پس از آن unset کنید. برای build یا اجرای عادی لازم نیست. |
| `APP_DOMAIN` | hostname مورد استفاده Caddy برای TLS و host routing؛ در Docker Compose الزامی است و باید با host داخل `APP_URL` یکسان باشد. در Caddy ویندوز نیز باید در محیط process تنظیم شود. |
| `APP_URL` | به‌شدت توصیه می‌شود: origin عمومی HTTPS برای SEO، sitemap و لینک‌های مطلق؛ برخلاف عنوان کلی نمونه، startup آن را الزامی نمی‌کند و در نبود آن از origin درخواست استفاده می‌شود. تنظیم و بررسی Host/proxy معتبر مهم است. |
| `VITE_AUTH_ENABLED=false` | توصیه امنیتی و قرارداد پیکربندی فروشگاه در زمان **build و runtime**؛ احراز مشتری/مدیر شاهو مستقل از Better Auth است. wrapper در حالت نبود مقدار `false` می‌دهد و فقط رشته دقیق `true` را فعال نگه می‌دارد. `npm run dev/build/preview` از wrapper استفاده می‌کنند؛ Vite مستقیم آن را دور می‌زند. |
| `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`, `GROK_PREVIEW_CLIENT_SECRET` | برای فروشگاه فعلی لازم نیستند. فقط با مجوز آینده و فعال‌سازی اختیاری scaffold، secret را خارج از مخزن به runtime تزریق کنید. credential پیش‌نمایش hardcoded از archive خروجی حذف شده است؛ مالک credential باید احتمال افشا در نسخه ورودی را بررسی و در صورت لزوم rotate/revoke کند. هیچ credential واقعی اینجا درج نشود. |
| `SHAHOO_ADMIN_EMAIL`, `SHAHOO_ADMIN_PASSWORD_HASH` | فقط برای bootstrap مدیر اول لازم‌اند، نه الزامات startup. هر دو باید معتبر باشند. `SHAHOO_ADMIN_NAME` و `SHAHOO_ADMIN_MOBILE` اختیاری‌اند. رمز خام و hash را secret بدانید. اسکریپت `scripts/hash-admin-password.mjs` رمز را از **argv** می‌گیرد؛ رمز واقعی را در فرمان یا history ننویسید و از روال امن تأییدشده مالک برای ساخت hash سازگار `s2$...` و تزریق آن استفاده کنید. |
| `SHAHOO_ADMIN_ROTATE`, `SHAHOO_ADMIN_RECOVER` | در حالت عادی unset. مقدار `1` به‌ترتیب برای چرخش رمز مدیر فعال و بازیابی مدیر تعلیق/حذف‌شده و نقش `super_admin` است؛ فقط عملیات محدود و مجاز، با حذف پرچم بعد از اجرا. |
| `SHAHOO_TRUST_PROXY` | معمولاً unset؛ `1` فقط پشت proxy معتبری که `X-Forwarded-For` را بازنویسی می‌کند. در غیر این صورت IP قابل جعل و محدودسازی درخواست غیرقابل اتکاست. |
| `SEED_DEMO`, `ECHO_OTP`, `ALLOW_MOCK_PAYMENT`, `ALLOW_MOCK_SMS`, `ALLOW_DEV_CSP` | برای این انتشار unset/خاموش نگه دارید. کد در `NODE_ENV=production` رفتار توسعه‌ای آنها را فعال نمی‌کند؛ به‌جای تکیه بر این guard، صحت محیط را بررسی کنید. |
| `PAYMENT_PROVIDER`, `ZARINPAL_MERCHANT_ID`, `ZIBAL_MERCHANT`, `IDPAY_API_KEY` | در محدوده فعلی خالی. آداپترهای نام‌برده برای پرداخت واقعی متصل نیستند؛ mock صرفاً خارج از production و با هر دو `ALLOW_MOCK_PAYMENT=1` و `PAYMENT_PROVIDER=mock` فعال می‌شود. |
| `SMS_MODE`, `SMS_LIVE`, `SMS_PROVIDER` | در این انتشار `SMS_MODE=disabled` یا unset و `SMS_LIVE` خاموش بماند. فعال‌سازی زنده فقط با `NODE_ENV=production`، `SMS_MODE=live`، `SMS_LIVE=1` و provider شناخته‌شده انجام می‌شود؛ این تنظیمات به معنی اتصال، آزمون یا اجازه استفاده زنده نیست. `SMS_MODE=sandbox` فقط mock محلی صریح را ممکن می‌کند و fallback زنده ندارد. |
| `SMS_IR_API_KEY`, `SMS_API_KEY`, `SMS_IR_OTP_TEMPLATE_ID` | برای SMS.ir، کلید اصلی `SMS_IR_API_KEY` است؛ در صورت نبود آن کد `SMS_API_KEY` را به‌عنوان fallback می‌خواند. `SMS_IR_OTP_TEMPLATE_ID` باید شناسه عددی صحیح و مثبت قالب تأییدشده باشد. این مقادیر فقط خارج از مخزن و در secret manager/محیط امن قرار گیرند. |
| `SMS_API_KEY`, `SMS_SENDER` | `SMS_API_KEY` برای Kavenegar نیز استفاده می‌شود؛ `SMS_SENDER` اختیاری و مختص Kavenegar است. برای SMS.ir از `SMS_SENDER` استفاده نمی‌شود. |
| `STORAGE_PROVIDER`, `STORAGE_LOCAL_DIR`, `ALLOW_LOCAL_STORAGE` | در self-hosting با volume پایدار می‌توان `STORAGE_PROVIDER=local` و `ALLOW_LOCAL_STORAGE=true` را فعال کرد. روی Vercel/فایل‌سیستم ephemeral از local استفاده نکنید. |
| `STORAGE_S3_BUCKET` | برای S3 نام bucket را صریح تنظیم کنید؛ در Neon مقدار نمونه Staging برابر `shahoo-media` است. |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY` | قرارداد SHAHOO برای S3. آداپتر همچنین نام‌های AWS/Neon یعنی `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` را می‌پذیرد. تمام مقادیر فقط در secret manager/Vercel environment قرار گیرند. |


**Auth در Revision 02.1:** مقایسه مستقیم `VITE_AUTH_ENABLED` در `src/lib/auth/server.ts` و `src/lib/auth/gate-identity.server.ts` از helper دارای trim به مقایسه مقدار خام تغییر کرده است. اکنون در این مسیرها، wrapper و client تنها `true` دقیق scaffold را فعال می‌کند؛ ` true ` و مقادیر خالی/بدشکل خاموش‌اند. آزمون regression برای gate و import مستقیم server اضافه شده است. وضعیت دقیق اجرای جدید را در شواهد نهایی Revision 02.1 ببینید. مقدار `false` را در build/runtime صریح نگه دارید و در محیط منتخب واقعاً بررسی کنید. `npm run check:auth -- --dev-url http://127.0.0.1:8080` dev در حال اجرا را با مقدار build بعدی مقایسه می‌کند، **نه** خود bundle ساخته‌شده یا محیط production را.

## مهاجرت و seed

ترتیب دقیق ۱۵ فایل SQL در ریشه `migrations/` با `scripts/migrate.mjs` کشف می‌شود و بر اساس نام اعمال می‌گردد: `0002_shahoo_foundation.sql` تا `0012_batch_07_inventory_audit.sql`، سپس `0013_batch_09_payment_attempts.sql`، `0014_batch_09_payment_attempt_guards.sql`، `0015_batch_09_manual_review_guard.sql` و `0016_batch_09_verification_recovery.sql`. فایل `migrations/auth/0001_auth.sql` زیرشاخه است و توسط migrator ریشه اعمال نمی‌شود.

مهاجرت‌های Batch 09 جدول `payment_attempts` را برای مبلغ داخلی ریال، مبلغ مورد انتظار تومان، شناسه تلاش، کد پرداخت، شناسه verification، وضعیت، شواهد تأیید و خطای تسویه ایجاد/تکمیل می‌کنند. `0014` مبلغ PayPing را برای داده‌های قابل تقسیم بررسی می‌کند و index تلاش فعال را می‌سازد؛ `0015` حالت `manual_review` را به guard اضافه می‌کند؛ `0016` مقدار `verification_payment_ref_id` را برای retry امن verification اضافه می‌کند. پیش از اجرای روی داده موجود، هر داده غیرقابل تقسیم را بررسی کنید؛ مهاجرت عمداً از حدس‌زدن واحد مبلغ خودداری می‌کند.

پیش از مهاجرت هر محیط واقعی: سطح دسترسی و هدف را جداگانه تأیید کنید، نسخه پشتیبان قابل بازیابی بگیرید، روش توقف ترافیک/بازگشت و ارتقا را روی کپی مجاز بررسی کنید. پس از تزریق امن `DATABASE_URL`، در فرآیند migration تولیدی از `NODE_ENV=production SHAHOO_ALLOW_PRODUCTION_MIGRATE=1 npm run db:migrate` استفاده کنید. بدون `DATABASE_URL` migrator خطا می‌دهد. مراحل PostgreSQL در [POSTGRESQL_VERIFICATION.md](POSTGRESQL_VERIFICATION.md) آماده شده‌اند، نه اجرا یا تأیید شده‌اند.

Seed پایه در نخستین دسترسی مربوطه مجوزها، قالب‌های SMS، لوگو و تنظیمات پایه را آماده می‌کند؛ داده نمونه کاتالوگ، مقاله، بنر و کوپن فقط در non-production با `SEED_DEMO=1` وارد می‌شود. این تضمین به‌تنهایی معادل اثبات اجرای همزمان چند فرآیند یا صحت PostgreSQL واقعی نیست.

## امنیت و رسانه

- کوکی‌های سفارشی مشتری، مدیر، سبد و رسید `HttpOnly`، `SameSite=Lax` و `path=/` هستند؛ `Secure` وقتی `NODE_ENV=production` است فعال می‌شود. HTTPS معتبر و بررسی واقعی پاسخ‌های proxy/کوکی روی میزبان الزامی است. محافظت از نشست، ownership، RBAC، rate limiting و گزارش خطاها را در محیط واقعی دوباره بررسی کنید.
- CSP تولیدی `unsafe-eval` ندارد، اما `unsafe-inline` برای اسکریپت/استایل باقی است؛ nonce پیاده نشده است. هدرهای `nosniff`، `Referrer-Policy` و `Permissions-Policy` وجود دارند؛ HSTS فقط برای درخواست تشخیص‌داده‌شده HTTPS اضافه می‌شود. اطمینان از تشخیص HTTPS، سیاست proxy و پوشش تمامی پاسخ‌های میزبان هنوز لازم است.
- CMS رسانه را از مسیر مدیر احراز‌شده آپلود می‌کند؛ فایل ابتدا sanitize می‌شود، سپس با adapter انتخاب‌شده ذخیره و رکورد provider-qualified در دیتابیس ثبت می‌شود. adapterهای Local Disk و S3-compatible در کد موجودند. برای Vercel از S3 استفاده کنید؛ local disk فقط روی میزبان self-hosted با volume پایدار و `ALLOW_LOCAL_STORAGE=true` مجاز است. از object bucket و دیتابیس با هم پشتیبان بگیرید و restore جفت‌شده را آزمایش کنید. Neon Staging اکنون bucket خصوصی `shahoo-media` دارد، اما تا زمانی که credential و متغیرهای محیطی در Preview تنظیم و PUT/GET/DELETE واقعی تست نشده، integration عملیاتی تأییدشده محسوب نمی‌شود. Production bucket/credential در این مرحله ایجاد نشده است.
- قیمت در پایگاه به ریال صحیح است و نمایش به تومان. حمل و کد رهگیری دستی است؛ ثبت مرجوعی/استرداد دفتری به معنی پرداخت یا استرداد بانکی نیست. بدون تأیید درگاه واقعی، سفارش صندوق پرداخت‌شده نیست.

## فهرست پس از انتخاب میزبان — اجرا نشده

1. سازگاری artifact/preset و فرمان start، Node، معماری، env در build/runtime، TLS، proxy، health check و حداقل دسترسی را روی staging مجاز مشخص و آزمون کنید.
2. با داده ساختگی بررسی کنید PostgreSQL و migration، initialization و عملیات چنداتصالی مطابق [چک‌لیست](POSTGRESQL_VERIFICATION.md) کار می‌کنند. این کار را هرگز روی پایگاه تولید یا با داده مشتری آغاز نکنید.
3. اجرای واقعی پشتیبان/بازیابی، مانیتورینگ، بازیابی رسانه، ظرفیت، retention، مجوزها، برنامه rollback و بازیابی اضطراری را ثبت کنید.
4. صفحات عمومی، مسیرهای `robots.txt` و `sitemap.xml`، URL عمومی، صفحات حساس `noindex`، session/RBAC، واکنش‌گرایی، E2E و دسترس‌پذیری را روی محیط مجاز بسنجید.
5. رفع و تأیید شکاف‌های ثبت‌شده در یادداشت انتشار و تصمیم مستقل مالک لازم است. آداپتر S3-compatible در کد موجود است و bucket خصوصی Staging در Neon ساخته شده، اما اتصال زنده آن تا تزریق credential و آزمون PUT/GET/DELETE تأیید نشده است. SMS.ir، PayPing، پرداخت زنده، حمل API و hosting تولیدی همچنان به تأیید و آزمون مستقل نیاز دارند.

## Batch 09 provider status (2026-11-20)

PayPing is integrated into checkout through server-owned order creation and `payment_attempts`. The flow persists an attempt, calls `/v3/pay`, validates the HTTPS redirect URL, accepts a callback only after strict correlation and `/v3/pay/verify`, and settles through the existing idempotent capture path. Verification timeouts, HTTP 202, and provider 5xx are recorded as `provider_outcome_unknown` with the original verification reference and are retryable through the ownership-checked server function. Unknown initiation without a payment code remains an admin manual-review path and cannot be replaced blindly.

The provider remains disabled unless production PayPing configuration is explicitly supplied. No real PayPing credentials, payment, sandbox call, or PostgreSQL multi-connection run was used. The official OpenAPI does not label the currency unit; the IRR-to-Toman rule therefore still requires merchant confirmation before activation.

SMS.ir uses the Verify adapter and is disabled by default. `SMS_MODE=disabled` sends nothing, `SMS_MODE=sandbox` supports only the explicit local mock, and live operation requires production, `SMS_MODE=live`, `SMS_LIVE=1`, provider, API key, and approved template ID. No real SMS.ir credential or delivery was tested.

## وضعیت Batch 09 — 2026-11-19

اتصال PayPing در کد به چرخه پرداخت موجود اضافه شده است و تلاش پرداخت، شناسه درگاه، مبلغ، وضعیت تأیید بیرونی و خطای تسویه محلی در جدول مستقل `payment_attempts` نگهداری می‌شود. پاسخ 409 فقط در حالت رسمی `metaData.code=110` قابل قبول است. این تغییر به معنی تأیید تولید نیست: واحد مبلغ PayPing در OpenAPI رسمی مشخص نشده، sandbox مجاز در اختیار نبود، PostgreSQL واقعی و تماس زنده با درگاه اجرا نشده است. فعال‌سازی و استقرار همچنان deferred است.

## Batch 09 comprehensive provider status — 2026-11-20

PayPing and SMS.ir remain disabled until controlled account configuration. PayPing uses server-owned order attempts, integer IRR-to-Toman conversion, streamed callback limits, server verification, lease-based settlement recovery, and audited admin same-attempt recovery from unknown or manual-review states. SMS.ir requires explicit `SMS_MODE=live`, `SMS_LIVE=1`, production, API key, provider, and template ID; sandbox mode is mock-only and cannot fall through to live. No real provider or Windows VPS deployment was performed.


### PayPing environment (not configured by this repository)

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | Must be `payping` to select the provider |
| `PAYPING_LIVE` | Must be `1` to enable the live provider path in production |
| `PAYPING_API_KEY` | Secret API key issued by PayPing; keep only in the server environment |
| `PAYPING_RETURN_URL` | Public HTTPS callback URL, normally `https://<shop-host>/api/payment/payping/callback` |

Do not set these values until the merchant account, amount unit (Toman at the provider boundary), callback behavior, and sandbox/live contract have been confirmed with PayPing. No live request is performed by build or tests. Verification HTTP errors and malformed responses are treated as uncertain, not as proof of non-payment.


### Windows VPS build profile

The default `npm run build` retains the Vercel Nitro preset. For a self-hosted Windows Server VPS, use `npm run build:windows` to build the Nitro `node-server` preset, then run `npm run start:windows` from the project directory. The generated server entrypoint is `.output/server/index.mjs`. Run it under a persistent Windows service account (for example, a configured Windows service wrapper), not an interactive terminal. This profile has not yet been executed on a Windows VPS; validate the generated output, environment injection, reverse proxy, TLS, restart behavior, and logs before production.


### Expired inventory-hold maintenance

Unpaid inventory holds must be released even when no customer visits the store. Configure Windows Task Scheduler to run `npm run maintenance:release-expired-holds` every 5 minutes from the project directory, under the same restricted service account and environment as the application. The script examines up to 200 expired holds per run in batches of 40 and prints the number released; repeated runs drain larger backlogs. Keep `DATABASE_URL` and all other secrets in the task account's environment, not in the scheduled command or repository. The task has not yet been exercised on the target Windows VPS or a real PostgreSQL database.
