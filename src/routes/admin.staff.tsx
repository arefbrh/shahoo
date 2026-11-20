import { createFileRoute } from "@tanstack/react-router";
import { StaffView } from "@/components/site/admin-pages";
import { getStaffFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/staff")({
  loader: () => getStaffFn(),
  component: StaffPage,
});

function StaffPage() {
  return <StaffView data={Route.useLoaderData()} />;
}
