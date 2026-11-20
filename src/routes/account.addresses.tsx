import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountPanel } from "@/components/site/account-panel";
import { noindex } from "@/lib/seo";

const parent = getRouteApi("/account");
export const Route = createFileRoute("/account/addresses")({
  head: () => ({ meta: [{ title: "نشانی‌های من | شاهو" }, noindex] }),
  component: AddressesPage,
});
function AddressesPage() {
  const { account } = parent.useLoaderData();
  return <AccountPanel account={account} section="addresses" />;
}
