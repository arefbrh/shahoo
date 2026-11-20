const PRIVATE = ["/admin", "/account", "/cart", "/checkout", "/order", "/search", "/wishlist"];

export function isIndexablePath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || path.includes("\\")) return false;
  const bare = path.split("?")[0] ?? path;
  return !PRIVATE.some((prefix) => bare === prefix || bare.startsWith(`${prefix}/`));
}

export function publicOrigin(value: string): string {
  const origin = value.trim().replace(/\/$/, "");
  if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) return "";
  return origin;
}

export function absoluteUrl(origin: string, path: string): string | null {
  const base = publicOrigin(origin);
  if (!base || !isIndexablePath(path)) return null;
  return `${base}${path}`;
}

export function escapeXml(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const apos = "&" + "apos;";
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return amp;
    if (char === "<") return lt;
    if (char === ">") return gt;
    if (char === '"') return quot;
    return apos;
  });
}

export function sitemapXml(origin: string, paths: string[]): string {
  const locs = [...new Set(paths)]
    .map((path) => absoluteUrl(origin, path))
    .filter((loc): loc is string => loc !== null)
    .sort();
  const body = locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(origin: string): string {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order",
    "Disallow: /search",
    "Disallow: /wishlist",
  ];
  const map = absoluteUrl(origin, "/sitemap.xml");
  if (map) lines.push(`Sitemap: ${map}`);
  return `${lines.join("\n")}\n`;
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function canonicalLink(origin: string, path: string): Array<{ rel: "canonical"; href: string }> {
  const href = absoluteUrl(origin, path);
  return href ? [{ rel: "canonical", href }] : [];
}

export const noindex = { name: "robots", content: "noindex, nofollow" } as const;

export function organizationLd(input: { origin: string; name: string; description: string }) {
  const url = absoluteUrl(input.origin, "/");
  const logo = absoluteUrl(input.origin, "/assets/brand/shahoo-logo-primary.png");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    description: input.description,
    ...(url ? { url } : {}),
    ...(logo ? { logo } : {}),
  };
}

export function breadcrumbLd(origin: string, items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const href = absoluteUrl(origin, item.path);
      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        ...(href ? { item: href } : {}),
      };
    }),
  };
}

export function productLd(input: {
  origin: string;
  name: string;
  description: string;
  slug: string;
  sku: string;
  priceIrr: number;
  inStock: boolean;
  imageUrl: string;
}) {
  const url = absoluteUrl(input.origin, `/product/${input.slug}`);
  const image = input.imageUrl.startsWith("https://")
    ? input.imageUrl
    : input.imageUrl.startsWith("/")
      ? absoluteUrl(input.origin, input.imageUrl)
      : null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    sku: input.sku,
    brand: { "@type": "Brand", name: "شاهو" },
    ...(image ? { image } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "IRR",
      price: String(Math.trunc(input.priceIrr)),
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(url ? { url } : {}),
    },
  };
}

export function articleLd(input: { origin: string; slug: string; title: string; description: string }) {
  const url = absoluteUrl(input.origin, `/magazine/${input.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    inLanguage: "fa",
    ...(url ? { mainEntityOfPage: url } : {}),
  };
}

export function webPageLd(input: { origin: string; path: string; title: string; description: string }) {
  const url = absoluteUrl(input.origin, input.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.title,
    description: input.description,
    inLanguage: "fa",
    ...(url ? { url } : {}),
  };
}
