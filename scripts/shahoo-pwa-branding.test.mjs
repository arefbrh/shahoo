import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderBrandedInstallPage, renderBrandedManifest } from "./shahoo-pwa-branding.mjs";

test("uses the configured SHAHOO site title in the PWA manifest on Vercel hosts", () => {
  const site = JSON.parse(readFileSync(new URL("../src/lib/og/site.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(renderBrandedManifest("shahoo-abc.vercel.app", site));
  assert.equal(manifest.name, "شاهو SHAHOO");
  assert.equal(manifest.short_name, "شاهو SHAHOO");
});

test("uses the configured SHAHOO site title in the iOS install tutorial", () => {
  const html = renderBrandedInstallPage("Add {{APP_NAME}} to your Home Screen: {{APP_URL}}", {
    host: "shahoo-abc.vercel.app",
    url: "/?install=1&platform=ios",
    site: { title: "شاهو SHAHOO" },
  });
  assert.match(html, /Add شاهو SHAHOO to your Home Screen/);
  assert.doesNotMatch(html, /Grok App/);
  assert.doesNotMatch(html, /\{\{APP_NAME\}\}/);
});
