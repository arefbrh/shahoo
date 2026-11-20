import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/components/site/admin-pages";
import { listAdminOrdersFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/orders/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    status: typeof search.status === "string" ? search.status : "",
    paymentStatus: typeof search.paymentStatus === "string" ? search.paymentStatus : "",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
    page: Math.max(1, Number(search.page) || 1),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listAdminOrdersFn({ data: deps }),
  component: OrdersPage,
});

function OrdersPage() {
  return <OrdersView data={Route.useLoaderData()} />;
}
