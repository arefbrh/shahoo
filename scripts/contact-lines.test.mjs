import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import test from "node:test";
import ts from "typescript";

function emit(sourcePath, outfile, source) {
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: sourcePath,
  }).outputText;
  writeFileSync(outfile, js);
}

test("contact lines render nothing clickable until a real value is saved", async () => {
  const profileOut = new URL("./_public-profile.mjs", import.meta.url);
  const linesOut = new URL("./_contact-lines.mjs", import.meta.url);
  try {
    const profileSource = readFileSync(new URL("../src/lib/public-profile.ts", import.meta.url), "utf8").replace(
      'import type { StoreProfile } from "./store-types";\n',
      "",
    );
    emit("public-profile.ts", profileOut, profileSource);
    const linesSource = readFileSync(new URL("../src/components/site/contact-lines.tsx", import.meta.url), "utf8")
      .replace('import { contactRows } from "@/lib/public-profile";\n', 'import { contactRows } from "./_public-profile.mjs";\n')
      .replace('import type { StoreProfile } from "@/lib/store-types";\n', "");
    emit("contact-lines.tsx", linesOut, linesSource);
    const loaded = await import(`${linesOut.href}?t=${Date.now()}`);
    const empty = renderToString(createElement(loaded.ContactLines, { profile: { phone: "", email: "", address: "", whatsapp: "", instagram: "", telegram: "" } }));
    assert.match(empty, /اعلام نشده/);
    assert.doesNotMatch(empty, /href=/);
    assert.doesNotMatch(empty, /۱۲۳۴۵۶۷/);
    const sample = renderToString(
      createElement(loaded.ContactLines, {
        profile: {
          phone: "۰۲۱-۱۲۳۴۵۶۷۸",
          email: "info@shahoo-organic.ir",
          address: "تهران، زعفرانیه، خیابان مقدس اردبیلی، پلاک ۴۸",
          whatsapp: "۰۹۱۲-۱۲۳۴۵۶۷",
          instagram: "@shahoo.organic",
          telegram: "@shahoo_organic",
        },
      }),
    );
    assert.doesNotMatch(sample, /href=/);
    assert.doesNotMatch(sample, /info@shahoo-organic\.ir/);
    const real = renderToString(
      createElement(loaded.ContactLines, {
        profile: {
          phone: "02188776655",
          email: "hello@example.com",
          address: "تهران، خیابان ولیعصر، پلاک ۱۰",
          whatsapp: "",
          instagram: "",
          telegram: "",
        },
      }),
    );
    assert.match(real, /href="tel:02188776655"/);
    assert.match(real, /href="mailto:hello@example.com"/);
    assert.match(real, /ولیعصر/);
    assert.doesNotMatch(real, /href="[^"]*ولیعصر/);
  } finally {
    rmSync(profileOut, { force: true });
    rmSync(linesOut, { force: true });
  }
});
