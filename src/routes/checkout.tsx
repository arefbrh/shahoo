import { createFileRoute } from "@tanstack/react-router";
import { CheckoutView } from "@/components/site/checkout-view";
import { getCheckoutContext } from "@/server/commerce/api";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/checkout")({
  loader: () => getCheckoutContext(),
  head: () => ({ meta: [{ title: "تسویه حساب | شاهو" }, noindex] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return <CheckoutView initial={Route.useLoaderData()} />;
}
