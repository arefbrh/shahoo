import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountPanel } from "@/components/site/account-panel";
import { noindex } from "@/lib/seo";

const parent = getRouteApi("/account");
export const Route = createFileRoute("/account/orders")({
  head: () => ({ meta: [{ title: "سفارش‌های من | شاهو" }, noindex] }),
  component: OrdersPage,
});
function OrdersPage() {
  const { account } = parent.useLoaderData();
  return <AccountPanel account={account} section="orders" />;
}
