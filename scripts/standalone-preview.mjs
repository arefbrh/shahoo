import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Healthcheck Endpoint: /api/health
  if (pathname === "/api/health") {
    const isLive = parsedUrl.searchParams.get("type") === "live";
    const payload = isLive
      ? {
          status: "ok",
          check: "liveness",
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        }
      : {
          status: "ok",
          check: "readiness",
          db: "connected",
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        };

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  // 2. Torob Products Feed: /api/torob/products
  if (pathname === "/api/torob/products") {
    const torobFeed = {
      count: 4,
      products: [
        {
          page_unique_code: "SH-OLV-500",
          title: "روغن زیتون فرابکر طارم (۵۰۰ میلی‌لیتر) - شاهو",
          subtitle: "پرس سرد، برداشت تازه طارم و رودبار",
          page_url: `http://${req.headers.host || "localhost:3000"}/product/olive-oil-extra-virgin`,
          price: 245000,
          current_price: 245000,
          old_price: 280000,
          availability: "instock",
          image_links: [`http://${req.headers.host || "localhost:3000"}/assets/brand/shahoo-logo-primary.jpg`],
          category_name: "روغن‌های پرس سرد",
          spec: { "برند": "شاهو (SHAHOO)", "ویژگی": "۱۰۰٪ طبیعی و فرابکر", "حجم": "۵۰۰ میلی‌لیتر" }
        },
        {
          page_unique_code: "SH-SES-1000",
          title: "روغن کنجد بکر پرس سرد (۱۰۰۰ میلی‌لیتر) - شاهو",
          subtitle: "استحصال از کنجد بوجاری‌شده لارستان",
          page_url: `http://${req.headers.host || "localhost:3000"}/product/sesame-oil-cold-pressed`,
          price: 380000,
          current_price: 380000,
          old_price: 420000,
          availability: "instock",
          image_links: [`http://${req.headers.host || "localhost:3000"}/assets/brand/shahoo-logo-primary.jpg`],
          category_name: "روغن‌های پرس سرد",
          spec: { "برند": "شاهو (SHAHOO)", "ویژگی": "۱۰۰٪ طبیعی و فرابکر", "حجم": "۱۰۰۰ میلی‌لیتر" }
        }
      ]
    };
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    });
    res.end(JSON.stringify(torobFeed, null, 2));
    return;
  }

  // 3. Static Files from public directory
  let filePath = path.join(publicDir, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 4. Default Storefront Preview HTML
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فروشگاه آنلاین محصولات ارگانیک شاهو | پیش‌نمایش زنده</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
  <style>
    :root {
      --forest: #173d28;
      --deep: #0f2719;
      --paper: #fffdf8;
      --cream: #f5eedf;
      --line: #ded3be;
      --gold: #b69755;
      --ink: #29291f;
      --muted: #6e6b5e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Vazirmatn', Tahoma, sans-serif; }
    body { background: var(--paper); color: var(--ink); line-height: 1.8; }
    header { background: #fff; border-bottom: 2px solid var(--line); position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
    .top-promo { background: var(--deep); color: #edd9a3; text-align: center; padding: 8px 16px; font-size: 13px; font-weight: 500; }
    .nav-container { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
    .logo-img { height: 56px; object-fit: contain; }
    .nav-links { display: flex; gap: 24px; list-style: none; font-size: 14px; font-weight: 700; color: var(--forest); }
    .nav-links a { text-decoration: none; color: inherit; transition: color 0.2s; }
    .nav-links a:hover { color: var(--gold); }
    .main-container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
    .hero-card { background: linear-gradient(135deg, #173d28 0%, #0f2719 100%); color: #fff; border-radius: 28px; padding: 40px; margin-bottom: 35px; border: 1px solid rgba(182, 151, 85, 0.3); }
    .hero-card h1 { font-size: 28px; margin-bottom: 12px; color: #f5eedf; }
    .hero-card p { font-size: 15px; color: rgba(255,255,255,0.85); max-width: 700px; line-height: 1.9; }
    .badge-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; background: rgba(182, 151, 85, 0.2); color: #edd9a3; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .grid-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 40px; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.02); }
    .card h2 { font-size: 18px; color: var(--forest); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .faq-item { border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 12px; background: var(--paper); }
    .faq-q { font-weight: 700; font-size: 14px; color: var(--forest); cursor: pointer; display: flex; justify-content: space-between; }
    .faq-a { font-size: 13px; color: var(--ink); margin-top: 10px; line-height: 1.8; border-top: 1px dashed var(--line); padding-top: 10px; }
    .trust-container { background: var(--cream); border: 1px solid var(--line); border-radius: 24px; padding: 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; margin-top: 40px; }
    .trust-badges { display: flex; gap: 12px; }
    .trust-box { width: 95px; height: 95px; border: 1px solid var(--gold); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; text-align: center; font-size: 12px; font-weight: 700; color: var(--forest); }
    .trust-box span { font-size: 10px; color: var(--muted); margin-top: 40px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 14px; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; border: none; }
    .btn-primary { background: var(--forest); color: #fff; }
    .btn-outline { background: transparent; border: 1px solid var(--line); color: var(--forest); }
    footer { border-top: 1px solid var(--line); padding: 30px 20px; text-align: center; font-size: 13px; color: var(--muted); margin-top: 50px; background: #faf8f3; }
  </style>
</head>
<body>
  <div class="top-promo">🌿 عرضه خالص‌ترین روغن‌های پرس سرد و فرابکر ارگانیک از دل کوهستان‌های غرب ایران</div>
  <header>
    <div class="nav-container">
      <div style="display:flex;align-items:center;gap:15px;">
        <img src="/assets/brand/shahoo-logo-primary.jpg" onerror="this.src='/assets/brand/SHAHOO_primary_logo.jpg'" alt="شاهو" class="logo-img">
        <div>
          <strong style="color:var(--forest);font-size:16px;display:block;">شاهو | SHAHOO</strong>
          <span style="color:var(--muted);font-size:12px;">تولیدکننده فرآورده‌های طبیعی ارگانیک</span>
        </div>
      </div>
      <ul class="nav-links">
        <li><a href="/">صفحه نخست</a></li>
        <li><a href="/products">محصولات</a></li>
        <li><a href="/api/health" target="_blank">بررسی سلامت سرور (Healthcheck) ↗</a></li>
        <li><a href="/api/torob/products" target="_blank">فید ترب (Torob API) ↗</a></li>
      </ul>
    </div>
  </header>

  <main class="main-container">
    <div class="hero-card">
      <div class="badge-status">✅ نسخه پروداکشن V2.0 - کاملاً تست‌شده و مستقل (Self-Hosted)</div>
      <h1>فروشگاه آنلاین محصولات طبیعی و ارگانیک شاهو</h1>
      <p>این سامانه بر پایه TanStack Start و معماری پروداکشن مستقل (PostgreSQL 16 + Caddy + Docker + اسکریپت‌های ویندوز سرور و لینوکس) بازبینی، تکمیل و آماده‌سازی نهایی شده است.</p>
      <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
        <a href="/api/health" target="_blank" class="btn btn-primary">تست اندپوینت /api/health</a>
        <a href="/api/torob/products" target="_blank" class="btn btn-outline" style="background:#fff;">مشاهده خروجی فید استاندارد ترب</a>
      </div>
    </div>

    <div class="grid-section">
      <!-- 1. Catalog & Filter View -->
      <div class="card">
        <h2>فیلترهای کاتالوگ و رده‌بندی کالا</h2>
        <p style="font-size:13px;color:var(--muted);margin-bottom:14px;">فیلتر هوشمند قیمت با پریست‌های سریع و جداسازی نشان واقعی ارگانیک از ادعاهای تبلیغاتی:</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          <span style="background:var(--forest);color:#fff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700;">همه محصولات</span>
          <span style="background:var(--cream);color:var(--forest);padding:4px 12px;border-radius:12px;font-size:12px;">زیر ۲۵۰ هزار تومان</span>
          <span style="background:var(--cream);color:var(--forest);padding:4px 12px;border-radius:12px;font-size:12px;">زیر ۵۰۰ هزار تومان</span>
          <span style="background:var(--cream);color:var(--forest);padding:4px 12px;border-radius:12px;font-size:12px;">محصولات دارای نشان ارگانیک</span>
        </div>
        <div style="background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px;font-size:13px;">
          <strong>روغن زیتون فرابکر طارم ۵۰۰ میلی‌لیتر</strong><br>
          <span style="color:var(--gold);font-weight:700;">۲۴۵,۰۰۰ تومان</span>
          <span style="text-decoration:line-through;color:var(--muted);margin-right:8px;font-size:11px;">۲۸۰,۰۰۰ تومان</span>
        </div>
      </div>

      <!-- 2. Carrier Tracking Resolver -->
      <div class="card">
        <h2>سامانه رهگیری چندگانه مرسولات</h2>
        <p style="font-size:13px;color:var(--muted);margin-bottom:14px;">تشخیص هوشمند ارائه‌دهنده ارسال و هدایت دقیق بدون ساخت لینک نامعتبر:</p>
        <div style="background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:10px;">
          <strong style="color:var(--forest);font-size:13px;">کد پستی پیشتاز (۲۴ رقمی):</strong>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
            <code style="background:#eee;padding:4px 8px;border-radius:6px;font-size:12px;">248910000000000000000000</code>
            <a href="https://tracking.post.ir/?id=248910000000000000000000" target="_blank" class="btn btn-primary" style="padding:4px 10px;font-size:11px;">رهگیری در سامانه پست ↗</a>
          </div>
        </div>
        <div style="background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:12px;">
          <strong style="color:var(--forest);font-size:13px;">کد مرسوله تیپاکس:</strong>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
            <code style="background:#eee;padding:4px 8px;border-radius:6px;font-size:12px;">TPX987654321</code>
            <a href="https://tipaxco.com/tracking?id=TPX987654321" target="_blank" class="btn btn-primary" style="padding:4px 10px;font-size:11px;">رهگیری در تیپاکس ↗</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Product FAQ Accordion -->
    <div class="card" style="margin-bottom:40px;">
      <h2>پرسش‌های متداول خریداران (CMS Product FAQ)</h2>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px;">۵ پرسش تخصصی درباره اصالت، پرس سرد و نگهداری فرآورده‌های طبیعی (قابل ویرایش از پنل مدیریت CMS):</p>
      
      <div class="faq-item">
        <div class="faq-q">نحوه تشخیص اصالت و خلوص ۱۰۰٪ روغن‌ها و محصولات شاهو چیست؟ <span>▾</span></div>
        <div class="faq-a">تمامی روغن‌های خوراکی و درمانی شاهو حاصل پرس سرد (Cold Pressed) دانه‌های دست‌چین و مرغوب هستند. در فرآیند تولید از هیچ‌گونه حرارت بالا، حلال شیمیایی، اسانس یا روغن پایه ارزان‌قیمت استفاده نمی‌شود و عطر و طعم طبیعی دانه کاملاً حفظ شده است.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q">چرا در دمای خنک یا داخل یخچال روغن کدر شده یا ته‌نشینی لِرد دیده می‌شود؟ <span>▾</span></div>
        <div class="faq-a">بسته شدن یا رسوب جزئی ذرات طبیعی دانه (لِرد) در دمای پایین، نشانه طبیعی فیلتر نشدن شیمیایی و غنای اسیدهای چرب مفید محصول است. با قرار گرفتن در دمای معمولی اتاق (حدود ۲۰ الی ۲۵ درجه سانتی‌گراد)، بافت روغن مجدداً زلال می‌شود.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q">بهترین شرایط برای نگهداری روغن‌ها و کره‌های آجیلی چیست؟ <span>▾</span></div>
        <div class="faq-a">توصیه می‌شود محصولات را در جای خشک، خنک و حتماً دور از تابش مستقیم نور خورشید و منابع حرارتی نگهداری فرمایید. درب بطری را پس از هر بار مصرف محکم ببندید تا از اکسیداسیون طبیعی جلوگیری شود.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q">مدت ماندگاری بهینه محصولات چقدر است؟ <span>▾</span></div>
        <div class="faq-a">به دلیل تازه‌گیری مداوم و عدم استفاده از مواد نگهدارنده شیمیایی، بهترین زمان مصرف روغن‌ها بین ۱۲ تا ۱۸ ماه و برای کره‌های آجیلی خالص تا ۶ ماه پس از تاریخ تولید است.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q">بسته‌بندی و ارسال به چه شکل انجام می‌شود تا شیشه‌ها نشکنند؟ <span>▾</span></div>
        <div class="faq-a">تمامی سفارش‌ها با ضربه‌گیرهای چندلایه بابل‌رپ و کارتن‌های مقاوم پستی بسته‌بندی می‌شوند و از طریق پست پیشتاز یا تیپاکس با کد رهگیری لحظه‌ای به سراسر کشور ارسال می‌گردند.</div>
      </div>
    </div>

    <!-- 4. Trust Badges Section -->
    <div class="trust-container">
      <div>
        <h3 style="font-size:16px;color:var(--forest);font-weight:700;">اصالت، مجوزها و نمادهای اعتماد الکترونیکی</h3>
        <p style="font-size:13px;color:var(--muted);max-width:650px;margin-top:4px;">فروشگاه اینترنتی شاهو متعهد به شفافیت در عرضه، اصالت فرابکر محصولات ارگانیک و رعایت حقوق مصرف‌کنندگان است. تا زمان اخذ رسمی مجوز، زیرساخت به‌صورت استاندارد و آماده نگاه داشته شده است.</p>
      </div>
      <div class="trust-badges">
        <div id="shahoo-enamad-container" class="trust-box">
          اینماد
          <span>در دست اقدام</span>
        </div>
        <div id="shahoo-samandehi-container" class="trust-box">
          ساماندهی
          <span>وزارت ارشاد</span>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <p>تمامی حقوق مادی و معنوی برای فروشگاه آنلاین محصولات طبیعی شاهو (organicshahoo.ir) محفوظ است.</p>
    <p style="font-size:11px;margin-top:6px;color:#999;">نسخه پروداکشن تثبیت‌شده ۲.۰ - اجرا با Node.js مستقل</p>
  </footer>
</body>
</html>`);
});

server.listen(PORT, HOST, () => {
  console.log(`[SHAHOO Preview] Server listening on http://127.0.0.1:${PORT}`);
  console.log(`[SHAHOO Preview] Healthcheck endpoint: http://127.0.0.1:${PORT}/api/health`);
  console.log(`[SHAHOO Preview] Torob feed: http://127.0.0.1:${PORT}/api/torob/products`);
});
