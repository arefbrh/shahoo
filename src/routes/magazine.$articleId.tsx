import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { JsonLd } from "@/components/site/json-ld";
import { ProductCardView } from "@/components/site/product-card";
import { pageKicker, pageTitle } from "@/components/site/ui";
import { articleLd, breadcrumbLd, canonicalLink } from "@/lib/seo";
import type { ProductCard } from "@/lib/store-types";
import { getArticle } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";
import { toPersianNum } from "@/lib/format";

export const Route = createFileRoute("/magazine/$articleId")({
  loader: async ({ params }) => {
    const [article, origin] = await Promise.all([getArticle({ data: { slug: params.articleId } }), getSeoOrigin()]);
    if (!article) throw notFound();
    return { article, origin };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.article.seoTitle || loaderData?.article.title || "مجله شاهو" },
      { name: "description", content: loaderData?.article.seoDescription || loaderData?.article.excerpt || "" },
    ],
    links: loaderData ? canonicalLink(loaderData.origin, `/magazine/${loaderData.article.slug}`) : [],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { article, origin } = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: "شاهو", path: "/" },
          { name: "مجله", path: "/magazine" },
          { name: article.title, path: `/magazine/${article.slug}` },
        ])}
      />
      <JsonLd data={articleLd({ origin, slug: article.slug, title: article.title, description: article.excerpt })} />
      <p className={pageKicker}>{article.categoryName}</p>
      <h1 className={pageTitle}>{article.title}</h1>
      <p className="mt-2 text-sm text-muted">{article.authorName} · {toPersianNum(article.readMinutes)} دقیقه مطالعه</p>
      {article.coverUrl ? (
        <img src={article.coverUrl} alt={article.coverAlt || article.title} loading="lazy" decoding="async" className="mt-6 max-h-80 w-full rounded-3xl border border-line bg-paper object-contain" />
      ) : null}
      <div className="mt-6 space-y-4 text-sm leading-8">
        {article.content.split("\n\n").map((paragraph: string) => (
          <p key={paragraph.slice(0, 20)}>{paragraph}</p>
        ))}
      </div>
      {article.related.length ? (
        <div className="mt-10">
          <h2 className="mb-4 font-bold text-forest">محصولات مرتبط</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {article.related.map((product: ProductCard) => (
              <ProductCardView key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : null}
      <Link to="/magazine" className="mt-8 inline-flex min-h-11 items-center text-sm font-bold text-forest">
        بازگشت به مجله
      </Link>
    </article>
  );
}
