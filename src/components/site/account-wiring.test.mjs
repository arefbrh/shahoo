import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** @param {string} name */
const file = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const account = file("./account-panel.tsx");

test("account navigation contains the five required localized sections and active state", () => {
  for (const label of ["اطلاعات شخصی", "سفارش‌های من", "نشانی‌های من", "تنظیمات حساب", "ارتباط با شاهو"]) {
    assert.ok(account.includes(label), `missing ${label}`);
  }
  assert.match(account, /aria-current=\{section === item\.id \? "page" : undefined\}/);
  assert.match(account, /grid-cols-2 gap-2 sm:grid-cols-5/);
});

test("every account section has a direct child route, with no customer ticket or duplicate wishlist route", () => {
  for (const route of ["orders", "addresses", "settings", "contact"]) {
    const source = file(`../../routes/account.${route}.tsx`);
    assert.match(source, new RegExp(`createFileRoute\\("/account/${route}"\\)`));
  }
  assert.doesNotMatch(account, /account\/support|account\/tickets|to="\/wishlist"/);
});
