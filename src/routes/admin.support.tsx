import { createFileRoute } from "@tanstack/react-router";
import { AdminSupport } from "@/components/site/support-desk";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupportPage,
});

function AdminSupportPage() {
  return <AdminSupport />;
}
