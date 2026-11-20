import { Link, createFileRoute } from "@tanstack/react-router";
import { toPersianNum } from "@/lib/format";
import { canonicalLink } from "@/lib/seo";
import type { ArticleCard } from "@/lib/store-types";
import { pageKicker, pageTitle } from "@/components/site/ui";
import { listArticles } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/magazine/")({
  loader: async () => {
    const [articles, origin] = await Promise.all([listArticles(), getSeoOrigin()]);
    return { articles, origin };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "مجله شاهو" },
      { name: "description", content: "یادداشت‌های کارگاه شاهو. این مطالب توصیه پزشکی نیستند." },
    ],
    links: canonicalLink(loaderData?.origin ?? "", "/magazine"),
  }),
  component: MagazinePage,
});

function MagazinePage() {
  const { articles } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={pageTitle}>مجله شاهو</h1>
      <p className="mt-2 text-sm text-muted">یادداشت‌های کارگاه. این مطالب توصیه پزشکی نیستند.</p>
      <div className="mt-6 space-y-4">
        {articles.length === 0 ? <p className="rounded-3xl border border-line bg-paper p-5 text-sm text-muted">هنوز مقاله منتشرشده‌ای در مجله نیست.</p> : null}
        {articles.map((article: ArticleCard) => (
          <Link key={article.slug} to="/magazine/$articleId" params={{ articleId: article.slug }} className="block rounded-3xl border border-line bg-paper p-5">
            <p className="text-xs font-bold text-gold">{article.categoryName}</p>
            <h2 className="mt-1 text-xl font-bold text-forest">{article.title}</h2>
            <p className="mt-2 text-sm leading-7">{article.excerpt}</p>
            <p className="mt-2 text-xs text-muted">
              {article.authorName} · {toPersianNum(article.readMinutes)} دقیقه
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
