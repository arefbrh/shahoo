import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AccountPanel } from "@/components/site/account-panel";
import { getCustomerAccount } from "@/server/auth/api";
import { getShell } from "@/server/storefront/api";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/account")({
  loader: async () => ({ account: await getCustomerAccount(), shell: await getShell() }),
  head: () => ({ meta: [{ title: "حساب کاربری | شاهو" }, noindex] }),
  component: AccountPage,
});

function AccountPage() {
  const { account } = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/account" || pathname === "/account/") return <AccountPanel account={account} section="profile" />;
  return <Outlet />;
}
