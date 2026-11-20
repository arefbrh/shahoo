import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLogin } from "@/components/site/admin-panel";
import { AdminShell } from "@/components/site/admin-shell";
import { getAdminSession } from "@/server/auth/api";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminSession(),
  head: () => ({ meta: [{ title: "مدیریت شاهو" }, noindex] }),
  component: AdminLayout,
});

function AdminLayout() {
  const session = Route.useLoaderData();
  if (!session.authenticated) return <AdminLogin />;
  return (
    <AdminShell session={session}>
      <Outlet />
    </AdminShell>
  );
}
