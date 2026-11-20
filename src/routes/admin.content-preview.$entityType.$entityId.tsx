import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { AdminDenied } from "@/components/site/admin-shell";
import { getContentPreviewFn } from "@/server/cms/api";
import { noindex } from "@/lib/seo";
import { pageKicker, pageTitle } from "@/components/site/ui";
import { toPersianNum } from "@/lib/format";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/content-preview/$entityType/$entityId")({
  loader: async ({ params }) => {
    if (params.entityType !== "page" && params.entityType !== "article") return null;
    try {
      return await getContentPreviewFn({ data: { entityType: params.entityType, entityId: params.entityId } });
    } catch {
      return null;
    }
  },
  head: () => ({ meta: [{ title: "پیش‌نمایش خصوصی محتوا · شاهو" }, noindex] }),
  component: ContentPreviewRoute,
});

function ContentPreviewRoute() {
  const session = parent.useLoaderData();
  const preview = Route.useLoaderData();
  if (!session.authenticated) return null;
  if (!session.permissions.includes("content.write")) return <AdminDenied message="پیش‌نمایش محتوا فقط برای مدیران دارای دسترسی محتوا فعال است." />;
  if (!preview) {
    return <div className="mx-auto max-w-3xl space-y-4 py-10"><p className="text-sm text-muted">محتوا پیدا نشد یا دسترسی پیش‌نمایش ندارید.</p><Link to="/admin/content" className="text-sm font-bold text-forest">بازگشت به مدیریت محتوا</Link></div>;
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4">
        <div>
          <p className="text-xs font-bold text-muted">پیش‌نمایش خصوصی مدیریت شاهو</p>
          <p className="mt-1 text-sm font-bold text-forest">{preview.status === "published" ? "نسخه منتشرشده" : "پیش‌نویس · فقط مدیران"}</p>
        </div>
        <Link to="/admin/content" className="text-sm font-bold text-forest">بازگشت به ویرایش محتوا</Link>
      </div>
      {preview.kind === "page" ? (
        <article>
          <p className={pageKicker}>SHAHOO</p>
          <h1 className={pageTitle}>{preview.title}</h1>
          <div className="mt-6 space-y-4 text-sm leading-8">{preview.body.split("\n\n").filter(Boolean).map((block, index) => <p key={index}>{block}</p>)}</div>
        </article>
      ) : (
        <article>
          <p className={pageKicker}>{preview.categoryName || "مجله شاهو"}</p>
          <h1 className={pageTitle}>{preview.title}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{preview.excerpt}</p>
          <p className="mt-2 text-xs text-muted">{preview.authorName} · {toPersianNum(preview.readMinutes)} دقیقه مطالعه</p>
          {preview.coverUrl ? <img src={preview.coverUrl} alt={preview.coverAlt || preview.title} className="mt-6 max-h-96 w-full rounded-3xl border border-line bg-paper object-contain" /> : null}
          <div className="mt-6 space-y-4 text-sm leading-8">{preview.body.split("\n\n").filter(Boolean).map((block, index) => <p key={index}>{block}</p>)}</div>
        </article>
      )}
    </main>
  );
}
