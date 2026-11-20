import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersLayout,
});

export function CustomersLayout() {
  return <Outlet />;
}
