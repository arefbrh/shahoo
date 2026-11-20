import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/site/admin-pages";
import { getInventoryDeskFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/inventory")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    categoryId: typeof search.categoryId === "string" ? search.categoryId : "",
    stock: search.stock === "low" || search.stock === "out" ? search.stock : "",
    page: Math.max(1, Math.min(500, Number(search.page) || 1)),
    logPage: Math.max(1, Math.min(500, Number(search.logPage) || 1)),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getInventoryDeskFn({ data: deps }),
  component: InventoryPage,
});

function InventoryPage() {
  return <InventoryView data={Route.useLoaderData()} />;
}
