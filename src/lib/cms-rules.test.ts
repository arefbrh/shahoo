import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bannerIsVisible, imageMimeFromUrl, isOfficialBrandAsset, isPublicHomeSection, normalizeSectionConfig, parseExternalMediaUrl, parsePublicHref, parseSchedule, parseSlug, permutationOrder, safeBannerImage } from "./cms-rules.ts";
import { carouselIndex, carouselIndicatorTargets } from "./home-carousel.ts";

test("section order must be a complete permutation", () => {
  assert.deepEqual(permutationOrder(["a", "b"], ["b", "a"]), ["b", "a"]);
  assert.equal(permutationOrder(["a", "b"], ["a"]), null);
  assert.equal(permutationOrder(["a", "b"], ["a", "a"]), null);
  assert.equal(permutationOrder(["a", "b"], ["a", "c"]), null);
});

test("product sections keep a bounded limit and known flags", () => {
  const ok = normalizeSectionConfig("best_sellers", { limit: 4, flags: ["best", "best"] });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.config.flags, ["best"]);
  assert.equal(normalizeSectionConfig("best_sellers", { limit: 0, flags: [] }).ok, false);
  assert.equal(normalizeSectionConfig("brand_benefits", { items: [] }).ok, false);
  const benefits = normalizeSectionConfig("brand_benefits", { items: [{ title: "خلوص", text: "بدون افزودنی" }] });
  assert.equal(benefits.ok, true);
});

test("links are site paths or https, never a script", () => {
  assert.equal(parsePublicHref("/products?category=oils"), "/products?category=oils");
  assert.equal(parsePublicHref("https://shahoo.example/page"), "https://shahoo.example/page");
  assert.equal(parsePublicHref("javascript:alert(1)"), null);
  assert.equal(parsePublicHref("//evil.example"), null);
  assert.equal(parsePublicHref("http://example.com/a"), null);
  assert.equal(parsePublicHref("/../secret"), null);
  assert.equal(safeBannerImage("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(safeBannerImage("/media/file/med-aaaaaaaa"), "/media/file/med-aaaaaaaa");
  assert.equal(safeBannerImage("/assets/brand/shahoo-logo-primary.png"), "/assets/brand/shahoo-logo-primary.png");
  assert.equal(safeBannerImage("javascript:alert(1)"), "");
  assert.equal(safeBannerImage("../etc/passwd"), "");
});

test("external media is an https image and brand files stay official", () => {
  assert.equal(parseExternalMediaUrl("https://cdn.example/oils/sesame.png?v=1"), "https://cdn.example/oils/sesame.png?v=1");
  assert.equal(imageMimeFromUrl("https://cdn.example/oils/sesame.png"), "image/png");
  assert.equal(parseExternalMediaUrl("https://cdn.example/file.txt"), null);
  assert.equal(parseExternalMediaUrl("http://cdn.example/a.png"), null);
  assert.equal(isOfficialBrandAsset("/assets/brand/shahoo-logo-primary.png"), true);
  assert.equal(isOfficialBrandAsset("https://cdn.example/a.png"), false);
});

test("banner schedule rejects an end before the start and hides a future slide", () => {
  const bad = parseSchedule("2026-05-10", "2026-05-01");
  assert.equal(bad.ok, false);
  const open = parseSchedule("", "");
  assert.equal(open.ok, true);
  if (!open.ok) return;
  assert.equal(bannerIsVisible(open.startsAt, open.endsAt, Date.parse("2026-01-01T00:00:00Z")), true);
  const future = parseSchedule("2026-12-01", "");
  assert.equal(future.ok, true);
  if (!future.ok || !future.startsAt) return;
  assert.equal(bannerIsVisible(future.startsAt, null, Date.parse("2026-01-01T00:00:00Z")), false);
});

test("slugs stay latin", () => {
  assert.equal(parseSlug("Black-Seed"), "black-seed");
  assert.equal(parseSlug("روغن"), null);
  assert.equal(parseSlug("a"), null);
});

test("the homepage hero still uses the official primary logo", () => {
  const source = readFileSync(new URL("../components/site/home-view.tsx", import.meta.url), "utf8");
  assert.match(source, /\/assets\/brand\/shahoo-logo-primary\.png/);
});

test("the removed legacy section is excluded without hiding unrelated sections", () => {
  assert.equal(isPublicHomeSection({ id: "sec-featured", sectionType: "featured_products", title: "نام ویرایش‌شده" }), false);
  assert.equal(isPublicHomeSection({ id: "other-featured", sectionType: "featured_products", title: "انتخاب مدیر" }), true);
  assert.equal(isPublicHomeSection({ sectionType: "best_sellers", title: " برگزیده‌ها " }), false);
  assert.equal(isPublicHomeSection({ sectionType: "hero", title: "برگزیده‌ها" }), true);
  for (const sectionType of ["best_sellers", "new_arrivals", "special_offers", "featured_categories"]) {
    assert.equal(isPublicHomeSection({ sectionType, title: "نام مدیر" }), true);
  }
});

test("three indicator slots and wrap navigation cover every CMS banner", () => {
  assert.deepEqual(carouselIndicatorTargets(0, 0), [null, null, null]);
  assert.deepEqual(carouselIndicatorTargets(1, 0), [0, null, null]);
  assert.deepEqual(carouselIndicatorTargets(2, 1), [0, 1, null]);
  assert.deepEqual(carouselIndicatorTargets(3, 2), [0, 1, 2]);
  assert.deepEqual(carouselIndicatorTargets(4, 3), [3, null, null]);
  assert.deepEqual(carouselIndicatorTargets(8, 5), [3, 4, 5]);
  assert.deepEqual(carouselIndicatorTargets(8, 7), [6, 7, null]);
  assert.equal(carouselIndex(-1, 8), 7);
  assert.equal(carouselIndex(8, 8), 0);
  assert.equal(carouselIndex(1, 0), 0);
  for (let count = 1; count <= 8; count += 1) {
    for (let index = 0; index < count; index += 1) {
      const slots = carouselIndicatorTargets(count, index);
      assert.equal(slots.length, 3);
      assert.ok(slots.includes(index));
    }
  }
});
