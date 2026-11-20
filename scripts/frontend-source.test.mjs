// Batch 03 source-level checks (static file inspection, NOT a browser run).
// Pure fs: needs no installed packages.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (d) =>
  readdirSync(d).flatMap((name) => {
    const full = join(d, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const routeFiles = readdirSync(join(root, "src/routes")).filter((f) => /\.(tsx|ts)$/.test(f) && f !== "__root.tsx");
const routeNames = routeFiles.map((f) => f.replace(/\.(tsx|ts)$/, "").replace(/\[\.\]/g, "."));
const patterns = new Set(["/"]);
for (const name of routeNames) {
  const pattern = ("/" + name.split(".").join("/")).replace(/\/index$/, "") || "/";
  patterns.add(pattern.replace(/\/\$[^/]+/g, "/$"));
}
function resolves(href) {
  const clean = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const segs = clean.split("/");
  return [...patterns].some((p) => {
    const ps = p.split("/");
    return ps.length === segs.length && ps.every((s, i) => s === "$" || s === segs[i]);
  });
}

test("every internal link in the UI points at an existing route", () => {
  const files = walk(join(root, "src")).filter((f) => /\.tsx$/.test(f) && !f.includes("routeTree"));
  const broken = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/\b(?:to|href)="(\/[^"]*)"/g)) {
      if (m[1].startsWith("//") || m[1].includes("{")) continue;
      if (!resolves(m[1])) broken.push(`${file.replace(root, "")} -> ${m[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("removed customer support route is not linked anywhere", () => {
  for (const file of walk(join(root, "src")).filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes("routeTree"))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /["'`]\/account\/support/, file);
  }
});

test("every layout route that has children renders an Outlet", () => {
  for (const name of routeNames) {
    const hasChildren = routeNames.some((other) => other.startsWith(name + "."));
    if (!hasChildren) continue;
    const file = routeFiles.find((f) => f.replace(/\.(tsx|ts)$/, "") === name);
    assert.match(read(`src/routes/${file}`), /Outlet/, `${file} has child routes but no <Outlet />`);
  }
});

test("resource routes with a lookup turn a missing record into a not-found state", () => {
  for (const file of ["product.$productId.tsx", "magazine.$articleId.tsx"]) {
    assert.match(read(`src/routes/${file}`), /throw notFound\(\)/, file);
  }
  // Orders return null for unknown or foreign codes and the view shows a Persian unavailable page.
  assert.match(read("src/components/site/order-view.tsx"), /if \(!order\)/);
});

test("router has Persian error and not-found screens that never print the raw error", () => {
  const router = read("src/router.tsx");
  assert.match(router, /defaultErrorComponent: AppErrorComponent/);
  assert.match(router, /defaultNotFoundComponent: AppNotFoundComponent/);
  const component = read("src/lib/error-component.tsx");
  assert.match(component, /[؀-ۿ]{3,}/);
  assert.doesNotMatch(component, /error\.message|String\(error\)|\.stack/);
  assert.doesNotMatch(component, /Something went wrong|An unexpected error/);
  assert.doesNotMatch(component, /<main/, "the shell already provides <main>");
});

test("wishlist is scoped per session and is cleared on logout", () => {
  const store = read("src/lib/cart-store.ts");
  assert.match(store, /scope/);
  assert.match(store, /version: 3/);
  assert.match(store, /pending/);
  const account = read("src/components/site/account-panel.tsx");
  assert.match(account, /wishlistSync\.migrate\(\)/);
  assert.match(account, /wishlistSync\.logout\(\)/);
  assert.doesNotMatch(account, /mergeWishlistFn/, "login must go through the confirmed-migration controller");
  assert.doesNotMatch(account, /catch\(\(\) => undefined\)/, "no silently ignored failures");
  assert.match(account, /WishlistMigrationNotice/);
  assert.doesNotMatch(account, /useWishlist\.setState/);
  const product = read("src/components/site/product-view.tsx");
  assert.doesNotMatch(product, /\.catch\(\(\) => toggleWish/, "a failed request must not flip the heart");
  assert.match(product, /wishlistSync\.toggle/);
  assert.match(product, /wishlistSync\.load/);
  assert.match(read("src/routes/wishlist.tsx"), /wishlistSync\.load/);
});

test("cart view guards duplicate writes, drops stale responses and reports failures", () => {
  const view = read("src/components/site/cart-view.tsx");
  assert.match(view, /busyRef/);
  assert.match(view, /createLatestGate/);
  assert.match(view, /CART_SET_UNCERTAIN/);
  assert.match(view, /CART_READ_FAILED/);
  assert.match(view, /تلاش دوباره/);
  assert.doesNotMatch(view, /onChange=\{\(event\) => void update/, "typing must not fire a write per keystroke");
});

test("media registration uses HTTPS URLs and cannot double-submit", () => {
  const desk = read("src/components/site/content-desk.tsx");
  assert.doesNotMatch(desk, /event\.currentTarget\.reset\(\)/);
  assert.match(desk, /registerMediaFn/);
  assert.match(desk, /registering/);
  assert.match(desk, /نشانی تصویر HTTPS/);
});

test("accessibility basics in the shell and shared field style", () => {
  const shell = read("src/components/site/shell.tsx");
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /id="main-content"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.equal((shell.match(/aria-label="جستجوی محصول"/g) ?? []).length, 2);
  const ui = read("src/components/site/ui.ts");
  assert.doesNotMatch(ui, /outline-none/);
  assert.match(ui, /focus-visible:outline/);
  assert.match(read("src/components/site/address-book.tsx"), /aria-label="کد پستی"/);
});

test("homepage sections stay CMS-driven and show a Persian empty-product state", () => {
  const home = read("src/components/site/home-view.tsx");
  assert.match(home, /data\.sections\.map/);
  assert.match(home, /pickProducts\(data\.products, section\.config\.flags/);
  assert.match(home, /هنوز محصولی برای نمایش در این بخش وجود ندارد/);
  assert.doesNotMatch(home, /if \(!products\.length\) return null/);
  const store = read("src/server/storefront/api.ts");
  assert.match(store, /\.from\(homepageSections\)/);
});
