import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminDenied } from "@/components/site/admin-shell";
import { OffersDesk } from "@/components/site/offers-desk";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/offers")({
  component: OffersPage,
});

function OffersPage() {
  const session = parent.useLoaderData();
  if (!session.authenticated) return null;
  const canRead = session.permissions.includes("settings.read") || session.permissions.includes("settings.write");
  if (!canRead) return <AdminDenied message="این بخش برای نقش شما باز نیست." />;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">تخفیف و ارسال</h1>
      <OffersDesk canWrite={session.permissions.includes("settings.write")} />
    </div>
  );
}
