import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminDenied } from "@/components/site/admin-shell";
import type { CmsDesk } from "@/lib/cms-types";
import { noindex } from "@/lib/seo";
import { getCmsDesk } from "@/server/cms/api";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/content-preview/$entityType/$slug")({
  head: () => ({ meta: [{ title: "پیش‌نمایش محتوا | مدیریت شاهو" }, noindex] }),
  component: ContentPreviewRoute,
});

function ContentPreviewRoute() {
  const session = parent.useLoaderData();
  const { entityType, slug } = Route.useParams();
  const [desk, setDesk] = useState<CmsDesk | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session.authenticated || !session.permissions.includes("content.write")) return;
    let active = true;
    void getCmsDesk()
      .then((result) => { if (active) setDesk(result); })
      .catch(() => { if (active) setError("بارگذاری پیش‌نمایش ممکن نشد. دوباره وارد مدیریت شوید."); });
    return () => { active = false; };
  }, [session.authenticated, session.permissions]);
  if (!session.authenticated) return null;
  if (!session.permissions.includes("content.write")) return <AdminDenied message="برای دیدن پیش‌نمایش محتوا دسترسی لازم را ندارید." />;
  if (error) return <p className="p-6 text-sm text-red-700" role="alert">{error}</p>;
  if (!desk) return <p className="p-6 text-sm text-muted">در حال آماده‌سازی پیش‌نمایش خصوصی...</p>;

  const page = entityType === "page" ? desk.pages.find((item) => item.slug === slug) : undefined;
  const article = entityType === "article" ? desk.articles.find((item) => item.slug === slug) : undefined;
  if ((entityType !== "page" && entityType !== "article") || (!page && !article)) {
    return <p className="p-8 text-sm text-muted">محتوای ذخیره‌شده پیدا نشد؛ ممکن است نامک تغییر کرده یا محتوا بازنشسته شده باشد.</p>;
  }
  const cover = article?.coverMediaId ? desk.media.find((item) => item.id === article.coverMediaId) : undefined;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-gold/40 bg-paper p-4 text-sm leading-7">
        <strong className="block text-forest">پیش‌نمایش خصوصی مدیریت</strong>
        <span>{page ? (page.isPublished ? "این صفحه منتشر شده است؛ اینجا نسخه ذخیره‌شده را می‌بینید." : "این صفحه هنوز منتشر نشده است و فقط مدیران دارای دسترسی محتوا می‌توانند پیش‌نمایش آن را ببینند.") : article?.status === "published" ? "این مقاله منتشر شده است؛ اینجا نسخه ذخیره‌شده را می‌بینید." : "این مقاله هنوز منتشر نشده است و فقط مدیران دارای دسترسی محتوا می‌توانند پیش‌نمایش آن را ببینند."}</span>
      </div>
      {page ? (
        <article className="mx-auto max-w-3xl py-4">
          <p className="text-xs font-bold tracking-wide text-muted">SHAHOO · پیش‌نمایش صفحه</p>
          <h1 className="mt-3 text-3xl font-bold text-forest">{page.title}</h1>
          <div className="mt-6 space-y-4 text-sm leading-8">{page.body.split("\n\n").filter(Boolean).map((block) => <p key={block.slice(0, 24)}>{block}</p>)}</div>
        </article>
      ) : article ? (
        <article className="mx-auto max-w-3xl py-4">
          <p className="text-xs font-bold text-muted">مجله شاهو · پیش‌نمایش مقاله</p>
          <h1 className="mt-3 text-3xl font-bold text-forest">{article.title}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{article.excerpt}</p>
          <p className="mt-2 text-xs text-muted">{article.authorName} · {article.readMinutes} دقیقه مطالعه</p>
          {cover ? <img src={cover.publicUrl} alt={cover.alt || article.title} className="mt-6 max-h-96 w-full rounded-3xl border border-line bg-paper object-contain" /> : null}
          <div className="mt-6 space-y-4 text-sm leading-8">{article.content.split("\n\n").filter(Boolean).map((block) => <p key={block.slice(0, 24)}>{block}</p>)}</div>
          {article.relatedProductIds.length ? <p className="mt-8 text-sm text-muted">محصولات مرتبط: {desk.products.filter((product) => article.relatedProductIds.includes(product.id)).map((product) => product.name).join("، ")}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
