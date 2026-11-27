import { createFileRoute } from "@tanstack/react-router";
import { OilGuideSearchPage } from "@/components/site/oil-guide-discovery";
import { searchOilGuide } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchOilGuide({ data: { query: deps.q } }),
  head: () => ({ meta: [{ title: "جستجو در راهنمای روغن | شاهو" }, { name: "robots", content: "noindex,follow" }] }),
  component: SearchPage,
});

function SearchPage() {
  const result = Route.useLoaderData();
  const { q } = Route.useSearch();
  return <OilGuideSearchPage status={result.status} query={q} oils={result.data} />;
}
