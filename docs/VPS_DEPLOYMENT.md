
# راهنمای جامع راه‌اندازی و استقرار شاهو روی سرور اختصاصی (VPS Deployment Guide)

این راهنما مراحل گام‌به‌گام راه‌اندازی و اجرای فروشگاه **شاهو (SHAHOO)** را روی یک سرور لینوکس ابری یا اختصاصی (Ubuntu 22.04 LTS / 24.04 LTS) به صورت کاملاً مستقل از Vercel و Neon آموزش می‌دهد.

---

## ۱. مشخصات و پیش‌نیازهای سرور (VPS Sizing)

* **سیستم‌عامل پیشنهادی:** Ubuntu 22.04 یا 24.04 LTS x86_64
* **حداقل منابع برای شروع:**
  * پردازنده (CPU): ۲ هسته
  * رم (RAM): ۴ گیگابایت
  * دیسک (Disk): ۴۰ الی ۶۰ گیگابایت NVMe/SSD
* **پورت‌های باز فایروال سرور:**
  * پورت `22` (SSH) — فقط برای دسترسی مدیر
  * پورت `80` (HTTP) — ترافیک وب (هدایت خودکار به HTTPS)
  * پورت `443` (HTTPS) — ترافیک امن وب و HTTP/3

> [!IMPORTANT]
> پورت دیتابیس PostgreSQL (`5432`) هرگز نباید در اینترنت عمومی باز شود. دیتابیس داخل شبکه ایزوله داکر (`shahoo_internal`) قرار دارد.

---

## ۲. آماده‌سازی امنیتی اولیه سرور (Server Hardening)

ابتدا با کاربر `root` به سرور متصل شوید و پکیج‌ها را به‌روز کنید:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban ca-certificates apt-transport-https
```

تنظیم منطقه زمانی به تهران و فعال‌سازی همگام‌سازی ساعت:
```bash
timedatectl set-timezone Asia/Tehran
timedatectl set-ntp true
```

پیکربندی فایروال `ufw`:
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## ۳. نصب Docker و Docker Compose

نصب آخرین نسخه پایدار داکر از مخازن رسمی:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
systemctl enable docker
systemctl start docker
```

بررسی نصب موفق:
```bash
docker --version
docker compose version
```

---

## ۴. استقرار سورس کد و تنظیم متغیرهای محیطی

یک دایرکتوری استاندارد برای اپلیکیشن بسازید و سورس کد را در آن قرار دهید:

```bash
mkdir -p /opt/shahoo
cd /opt/shahoo
# کپی سورس کد پروژه به این پوشه
```

فایل نمونه متغیرها را به `.env` کپی و رمزهای عبور اختصاصی تولید کنید:

```bash
cp .env.production.example .env
```

دو رمز عبور قوی و مستقل برای نقش مدیر PostgreSQL و نقش برنامه تولید کنید:
```bash
openssl rand -hex 32 # مقدار اول: POSTGRES_PASSWORD
openssl rand -hex 32 # مقدار دوم: APP_DB_PASSWORD
```

فایل `.env` را با `nano .env` ویرایش کرده و مقدار اول را در `POSTGRES_PASSWORD` و مقدار دوم را در `APP_DB_PASSWORD` قرار دهید. `POSTGRES_USER` باید نقش bootstrap مدیر و `APP_DB_USER` نقش غیرممتاز برنامه باشد. `APP_DOMAIN` را برابر hostname دامنه و `APP_URL` را برابر origin عمومی HTTPS همان دامنه قرار دهید؛ هر دو باید یک سایت را نشان دهند. `SHAHOO_TRUST_PROXY=1` را نیز فقط پشت پروکسی معتبر تنظیم کنید.

---

## ۵. اجرای اولیه دیتابیس و اعمال مایگریشن‌ها

ابتدا سرویس دیتابیس را روشن کنید:
```bash
docker compose up -d db
```

وضعیت سلامت دیتابیس را بررسی کنید:
```bash
docker compose ps
# ستون Status باید healthy باشد
```

در اولین راه‌اندازی روی Volume خالی، `scripts/init-db.sql` نقش غیرممتاز `APP_DB_USER` را می‌سازد و مالکیت دیتابیس/اسکیما را به آن می‌دهد. اگر Volume موجود است، این اسکریپت دوباره اجرا نمی‌شود؛ Volume را حذف نکنید و برای انتقال نقش‌ها/مالکیت یک برنامه جداگانه و بررسی DBA لازم است.

اجرای مایگریشن‌های اسکیما (این فرمان فقط با مجوز صریح یک‌باره Production اجرا می‌شود):
```bash
docker compose run --rm -e SHAHOO_ALLOW_PRODUCTION_MIGRATE=1 app node scripts/migrate.mjs
```

---

## ۶. بیلد و راه‌اندازی کل پشته (Full Stack Launch)

برای بالا آوردن اپلیکیشن، دیتابیس، ورکر و سرور پروکسی Caddy:

```bash
docker compose up -d --build
```

مشاهده لاگ‌های زنده:
```bash
docker compose logs -f
```

---

## ۷. بکاپ و پایش عملیاتی

پس از راه‌اندازی، پوشه‌های بکاپ را خارج از Volume دیتابیس نگه دارید:

```bash
sudo mkdir -p /opt/shahoo/backups/database /opt/shahoo/backups/media
sudo chown -R "$USER":"$USER" /opt/shahoo/backups
scripts/linux/backup-db.sh
scripts/linux/backup-media.sh
scripts/linux/monitor-health.sh
```

برای زمان‌بندی نمونه، Cron را فقط پس از بررسی مسیر و حساب اجراکننده تنظیم کنید:

```cron
0 3,15 * * * cd /opt/shahoo && ./scripts/linux/backup-db.sh
0 4 * * * cd /opt/shahoo && ./scripts/linux/backup-media.sh /opt/shahoo/backups/media 30
*/5 * * * * cd /opt/shahoo && ./scripts/linux/monitor-health.sh
```

بازیابی دیتابیس و رسانه مخرب است و فقط پس از بررسی فایل بکاپ و تأیید اپراتور اجرا می‌شود:

```bash
scripts/linux/restore-db.sh /opt/shahoo/backups/database/FILE.dump
scripts/linux/restore-media.sh /opt/shahoo/backups/media/FILE.tar.gz
```

**محدودیت مهم:** این اسکریپت‌ها بکاپ منطقی PostgreSQL و آرشیو فایل‌های رسانه را آماده می‌کنند. WAL archiving/PITR، رمزنگاری فایل بکاپ، انتقال Off-site و Restore Drill واقعی هنوز پیکربندی و تأیید نشده‌اند.

## ۸. بررسی دامنه و گواهی SSL

دامنه `organicshahoo.ir` و `www.organicshahoo.ir` را از طریق کنترل‌پنل دامنه (A Record) به آدرس آی‌پی عمومی سرور متصل کنید.  
پروکسی Caddy به صورت کاملاً خودکار گواهی رایگان Let's Encrypt را صادر کرده و HTTPS را فعال می‌کند.

---

## ۹. دستورات روزمره نگهداری

* **بررسی وضعیت تمام کانتینرها:**
  ```bash
  docker compose ps
  ```
* **مشاهده لاگ‌های برنامه:**
  ```bash
  docker compose logs -f app
  ```
* **مشاهده لاگ‌های وب‌سرور و دسترسی:**
  ```bash
  docker compose logs -f proxy
  ```
* **ریستارت تمیز سرویس‌ها:**
  ```bash
  docker compose restart app
  ```
* **به‌روزرسانی کد و ری‌بیلد بدون قطعی طولانی:**
  ```bash
  docker compose build app
  docker compose up -d --no-deps app
  ```
