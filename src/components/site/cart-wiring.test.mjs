import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** @param {string} name */
const file = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("drawer and standalone persist guarded set intents before network and clear only on ok", () => {
  for (const name of ["cart-drawer.tsx", "cart-view.tsx"]) {
    const source = file(name);
    assert.ok(source.indexOf("setCartRetry(current.retry ?? proposed)") < source.indexOf("await setCartItemFn"), name);
    assert.match(source, /if \(result\.ok\)\s*(?:\{\s*)?clearCartRetry\(\)/);
    assert.match(source, /sameCartIntent\(current\.retry, proposed\)/);
    assert.match(source, /window\.addEventListener\("focus", onFocus\)/);
  }
});

test("product add persists a generic marker before request and clears only on confirmed success", () => {
  const source = file("product-view.tsx");
  assert.ok(source.indexOf("if (!startCartAdd())") < source.indexOf("addCartItemFn({ data:"));
  assert.match(source, /if \(result\.ok\) clearCartAdd\(\)/);
  assert.match(source, /intents\.addPending/);
  assert.match(source, /wishlistSync\.load\(\)/);
  assert.match(source, /wishlistSync\.toggle\(product\.id\)/);
});

test("recovery is cart-scoped, manual and based on a reviewed read", () => {
  const source = file("cart-intent-notices.tsx");
  assert.match(source, /retry\.expectedCartId === cart\.cartId/);
  assert.match(source, /currentQuantity === retry\?\.expectedQuantity/);
  assert.match(source, /!addReviewReady/);
  assert.match(source, /if \(clearCartAdd\(\)\) onDiscard\(\)/);
});

test("cart navigation, draft resets and header read invalidation are wired", () => {
  const drawer = file("cart-drawer.tsx");
  const view = file("cart-view.tsx");
  const shell = file("shell.tsx");
  assert.match(drawer, /to="\/cart"/);
  assert.match(drawer, /باز کردن سبد خرید، \$\{toPersianNum\(count\)\} کالا/);
  assert.match(view, /\[line\.quantity, resetVersion\]/);
  assert.match(view, /setDraftRevision\(\(value\) => value \+ 1\)/);
  assert.match(shell, /const onDrawerCount = useCallback[\s\S]*?readSequence\.current \+= 1;[\s\S]*?setCount\(next\)/);
});

test("existing checkout guard covers unresolved adds and unavailable storage", () => {
  const client = file("cart-client.ts");
  assert.match(client, /state\.retryInvalid \|\| state\.addPending \|\| !state\.storageAvailable/);
});

test("legacy validation precedes removal and bypass keeps the old data", () => {
  const client = file("cart-client.ts");
  assert.ok(client.indexOf("parseLegacyCart(raw)") < client.indexOf('localStorage.removeItem("shahoo-cart-v1")'));
  assert.match(client, /export function bypassBrowserCart\(\) \{ bypassLegacy = true; \}/);
});
