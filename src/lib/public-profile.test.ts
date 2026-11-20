import assert from "node:assert/strict";
import test from "node:test";
import { contactRows, isSuppressedContact, parseProfileContact, publicPromo, storyIsConfigured, SEEDED_PROMO } from "./public-profile.ts";

const empty = { phone: "", email: "", address: "", whatsapp: "", instagram: "", telegram: "" };

test("empty and sample contact values produce no public rows or links", () => {
  assert.deepEqual(contactRows(empty), []);
  const sample = contactRows({
    phone: "۰۲۱-۱۲۳۴۵۶۷۸",
    email: "info@shahoo-organic.ir",
    address: "تهران، زعفرانیه، خیابان مقدس اردبیلی، پلاک ۴۸",
    whatsapp: "۰۹۱۲-۱۲۳۴۵۶۷",
    instagram: "@shahoo.organic",
    telegram: "@shahoo_organic",
  });
  assert.deepEqual(sample, []);
  assert.equal(isSuppressedContact("02112345678"), true);
  assert.equal(publicPromo(SEEDED_PROMO), "");
  assert.equal(publicPromo("  "), "");
  assert.equal(storyIsConfigured({ title: "", about: "", philosophy: "" }), false);
  assert.equal(
    storyIsConfigured({
      title: "چرا شاهو؟",
      about: "برند شاهو با الهام از کوهستان شاهو و دانش کهن گیاهان ایران شکل گرفت.",
      philosophy: "طبیعت بهترین کیفیت را در سادگی می‌دهد. محصولات در دسته‌های کوچک آماده می‌شوند.",
    }),
    false,
  );
});

test("an explicit contact profile is rendered with real links", () => {
  const parsed = parseProfileContact({
    phone: "02188776655",
    whatsapp: "09120001122",
    email: "hello@example.com",
    address: "تهران، خیابان ولیعصر، پلاک ۱۰",
    instagram: "shahoo.shop",
    telegram: "@shahoo_shop",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const rows = contactRows(parsed.value);
  assert.equal(rows.find((row) => row.key === "phone")?.href, "tel:02188776655");
  assert.equal(rows.find((row) => row.key === "email")?.href, "mailto:hello@example.com");
  assert.equal(rows.find((row) => row.key === "address")?.href, null);
  assert.match(rows.find((row) => row.key === "whatsapp")?.href ?? "", /^https:\/\/wa\.me\/989120001122$/);
  assert.equal(rows.find((row) => row.key === "instagram")?.href, "https://instagram.com/shahoo.shop");
  assert.equal(publicPromo("ارسال سفارش‌های ثبت‌شده جداگانه هماهنگ می‌شود"), "ارسال سفارش‌های ثبت‌شده جداگانه هماهنگ می‌شود");
  assert.equal(storyIsConfigured({ title: "معرفی", about: "متن تأییدشده فروشگاه.", philosophy: "جمله تأییدشده." }), true);
  assert.equal(parseProfileContact({ ...empty, phone: "۰۲۱-۱۲۳۴۵۶۷۸" }).ok, false);
});
