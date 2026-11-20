import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, isIndexablePath, jsonLd, productLd, robotsTxt, sitemapXml } from "./seo.ts";

test("private and unsafe paths stay out of the sitemap", () => {
  assert.equal(isIndexablePath("/admin"), false);
  assert.equal(isIndexablePath("/admin/orders"), false);
  assert.equal(isIndexablePath("/order/SH-1"), false);
  assert.equal(isIndexablePath("/checkout"), false);
  assert.equal(isIndexablePath("//evil.example"), false);
  assert.equal(isIndexablePath("/product/black-seed"), true);
  const xml = sitemapXml("https://shop.example", ["/product/a&b", "/admin", "/account", "/product/a&b"]);
  const encoded = "a" + "&" + "amp;b";
  assert.match(xml, new RegExp(encoded));
  assert.equal(xml.includes("/admin"), false);
  assert.equal(xml.includes("/account"), false);
  assert.equal(xml.split(encoded).length, 2);
});

test("robots points at the sitemap and blocks the desk", () => {
  const text = robotsTxt("https://shop.example");
  assert.match(text, /Disallow: \/admin/);
  assert.match(text, /Sitemap: https:\/\/shop\.example\/sitemap\.xml/);
  assert.equal(robotsTxt("not a host").includes("Sitemap:"), false);
  assert.equal(absoluteUrl("http://", "/products"), null);
});

test("product structured data has no rating and stores rials", () => {
  const data = productLd({
    origin: "https://shop.example",
    name: "روغن <سیاه>",
    description: "پرس سرد",
    slug: "black",
    sku: "SKU-1",
    priceIrr: 28900000,
    inStock: true,
    imageUrl: "",
  });
  const raw = jsonLd(data);
  assert.equal(raw.includes("aggregateRating"), false);
  assert.equal(raw.includes("review"), false);
  assert.match(raw, /"priceCurrency":"IRR"/);
  assert.match(raw, /"price":"28900000"/);
  assert.match(raw, /\\u003c/);
});
