import { createFileRoute } from "@tanstack/react-router";
import { CatalogView } from "@/components/site/catalog-view";
import { canonicalLink } from "@/lib/seo";
import { listCatalog } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

type Search = {
  category?: string;
  sort?: "popular" | "price-asc" | "price-desc" | "newest" | "rating";
  q?: string;
  max?: number;
  organic?: boolean;
  discounted?: boolean;
  best?: boolean;
  available?: boolean;
};

function flag(value: unknown) {
  return value === true || value === "true" || value === "1";
}

export const Route = createFileRoute("/products")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const sort = search.sort;
    const parsed: Search = {};
    if (typeof search.category === "string") parsed.category = search.category;
    if (sort === "price-asc" || sort === "price-desc" || sort === "newest" || sort === "rating" || sort === "popular") {
      parsed.sort = sort;
    }
    if (typeof search.q === "string") parsed.q = search.q;
    if (search.max !== undefined && search.max !== "") parsed.max = Number(search.max) || undefined;
    if (flag(search.organic)) parsed.organic = true;
    if (flag(search.discounted)) parsed.discounted = true;
    if (flag(search.best)) parsed.best = true;
    if (flag(search.available)) parsed.available = true;
    return parsed;
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [data, origin] = await Promise.all([
      listCatalog({
        data: {
          category: deps.category,
          sort: deps.sort,
          q: deps.q,
          maxToman: deps.max,
          organic: deps.organic,
          discounted: deps.discounted,
          best: deps.best,
          available: deps.available,
        },
      }),
      getSeoOrigin(),
    ]);
    return { ...data, origin };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "محصولات شاهو" },
      { name: "description", content: "روغن پرس سرد، کره مغزیجات، آجیل و گیاهان شاهو." },
    ],
    links: canonicalLink(loaderData?.origin ?? "", "/products"),
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const data = Route.useLoaderData();
  return <CatalogView products={data.products} categories={data.categories} query={data.query} />;
}
