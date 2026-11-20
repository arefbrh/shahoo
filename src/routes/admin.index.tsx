import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/site/admin-pages";
import { getDashboardFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>) => ({
    range: typeof search.range === "string" ? search.range : "30",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getDashboardFn({ data: deps }),
  component: AdminHome,
});

function AdminHome() {
  return <DashboardView data={Route.useLoaderData()} />;
}
