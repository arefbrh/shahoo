import type { SitePage } from "@/lib/store-types";
import { webPageLd } from "@/lib/seo";
import { pageKicker, pageTitle } from "./ui";
import { JsonLd } from "./json-ld";

export function ContentPage({ page, path = `/${page.slug}` }: { page: SitePage; path?: string }) {
  const blocks = page.body.split("\n\n").filter(Boolean);
  const title = page.seoTitle || page.title;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={webPageLd({ origin: page.origin, path, title, description: page.seoDescription })} />
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={pageTitle}>{page.title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-8">
        {blocks.map((block) => (
          <p key={block.slice(0, 24)}>{block}</p>
        ))}
      </div>
    </article>
  );
}
