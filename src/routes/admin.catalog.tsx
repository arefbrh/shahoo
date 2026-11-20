import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CatalogDesk } from "@/components/site/catalog-desk";
import { AdminDenied } from "@/components/site/admin-shell";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const session = parent.useLoaderData();
  if (!session.authenticated) return null;
  if (!session.permissions.includes("catalog.read")) return <AdminDenied message="این بخش برای نقش شما باز نیست." />;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">کاتالوگ</h1>
      <CatalogDesk
        canWrite={session.permissions.includes("catalog.write")}
        canInventory={session.permissions.includes("inventory.write")}
      />
    </div>
  );
}
