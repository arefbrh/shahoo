import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ReportsView } from "@/components/site/admin-pages";
import { getReportsFn } from "@/server/admin/api";

const searchSchema = z.object({ range: z.enum(["today", "7", "30", "all"]).catch("30") });

export const Route = createFileRoute("/admin/reports")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ deps }) => getReportsFn({ data: { range: deps.range } }),
  component: ReportsPage,
});

function ReportsPage() {
  return <ReportsView data={Route.useLoaderData()} />;
}
