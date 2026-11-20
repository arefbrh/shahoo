import { createFileRoute } from "@tanstack/react-router";
import { AdminOrderPage } from "@/components/site/admin-pages";
import { getOrderFn } from "@/server/commerce/api";

export const Route = createFileRoute("/admin/orders/$code")({
  loader: ({ params }) => getOrderFn({ data: { publicCode: params.code } }),
  component: OrderPage,
});

function OrderPage() {
  return <AdminOrderPage order={Route.useLoaderData()} />;
}
