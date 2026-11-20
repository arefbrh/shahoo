import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountPanel } from "@/components/site/account-panel";
import { noindex } from "@/lib/seo";

const parent = getRouteApi("/account");
export const Route = createFileRoute("/account/settings")({
  head: () => ({ meta: [{ title: "تنظیمات حساب | شاهو" }, noindex] }),
  component: SettingsPage,
});
function SettingsPage() {
  const { account } = parent.useLoaderData();
  return <AccountPanel account={account} section="settings" />;
}
