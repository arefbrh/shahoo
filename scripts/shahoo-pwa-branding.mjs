import { escapeHtml, renderInstallPageHtml, renderWebManifest } from "./grok-pwa-shared.mjs";

function resolveSiteName(site, fallback) {
  const configured = String(site?.title ?? "").trim();
  return configured || fallback;
}

export function renderBrandedManifest(host, site = {}) {
  const manifest = JSON.parse(renderWebManifest(host));
  const name = resolveSiteName(site, manifest.name);
  manifest.name = name;
  manifest.short_name = name;
  return JSON.stringify(manifest, null, 2);
}

export function renderBrandedInstallPage(template, { host, url, site = {} } = {}) {
  const html = renderInstallPageHtml(template, { host, url });
  const fallbackName = "Grok App";
  const name = resolveSiteName(site, fallbackName);
  return html.replaceAll(fallbackName, escapeHtml(name));
}
