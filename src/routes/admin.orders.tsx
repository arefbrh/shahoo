import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersLayout,
});

export function OrdersLayout() {
  return <Outlet />;
}
