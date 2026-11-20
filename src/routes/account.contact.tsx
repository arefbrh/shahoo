import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountPanel } from "@/components/site/account-panel";
import { noindex } from "@/lib/seo";

const parent = getRouteApi("/account");
export const Route = createFileRoute("/account/contact")({
  head: () => ({ meta: [{ title: "ارتباط با شاهو | شاهو" }, noindex] }),
  component: ContactPage,
});
function ContactPage() {
  const { account, shell } = parent.useLoaderData();
  return <AccountPanel account={account} section="contact" contactProfile={shell.profile} />;
}
