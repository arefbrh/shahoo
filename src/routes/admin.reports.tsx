import { createFileRoute } from "@tanstack/react-router";
import { ReportsView } from "@/components/site/admin-pages";
import { getReportsFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/reports")({
  loader: () => getReportsFn(),
  component: ReportsPage,
});

function ReportsPage() {
  return <ReportsView data={Route.useLoaderData()} />;
}
