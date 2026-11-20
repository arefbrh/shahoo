import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/site/catalog-view";
import { listCatalog } from "@/server/storefront/api";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listCatalog({ data: { q: deps.q, category: "all" } }),
  head: () => ({ meta: [{ title: "جستجو | شاهو" }, noindex] }),
  component: SearchPage,
});

function SearchPage() {
  const data = Route.useLoaderData();
  return (
    <div>
      <CatalogView products={data.products} categories={data.categories} query={data.query} />
    </div>
  );
}
