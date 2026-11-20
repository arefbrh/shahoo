import { createFileRoute } from "@tanstack/react-router";
import { CartView } from "@/components/site/cart-view";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "سبد خرید | شاهو" }, noindex] }),
  component: CartView,
});
