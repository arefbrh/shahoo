import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminDenied } from "@/components/site/admin-shell";
import { ContentDesk } from "@/components/site/content-desk";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
});

function ContentPage() {
  const session = parent.useLoaderData();
  if (!session.authenticated) return null;
  if (!session.permissions.includes("content.write")) return <AdminDenied message="این بخش برای نقش شما باز نیست." />;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">محتوا</h1>
      <p className="mt-2 max-w-2xl text-sm leading-8 text-muted">
        صفحه اول، منو، صفحه‌های ثابت و مجله از همین‌جا عوض می‌شوند. پرداخت، پیامک و فایل روی سرور ساخته نمی‌شود.
      </p>
      <ContentDesk />
    </div>
  );
}
