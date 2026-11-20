import { createFileRoute } from "@tanstack/react-router";
import { OrderDetail } from "@/components/site/order-view";
import { getOrderFn } from "@/server/commerce/api";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/order/$orderId")({
  loader: ({ params }) => getOrderFn({ data: { publicCode: params.orderId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `سفارش ${loaderData.publicCode} | شاهو` : "پیگیری سفارش | شاهو" }, noindex],
  }),
  component: OrderPage,
});

function OrderPage() {
  return <OrderDetail order={Route.useLoaderData()} />;
}
