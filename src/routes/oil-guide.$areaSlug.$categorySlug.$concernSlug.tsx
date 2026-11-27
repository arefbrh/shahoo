import { createFileRoute } from "@tanstack/react-router";
import { OilGuideConcernPage } from "@/components/site/oil-guide-discovery";
import { getOilGuideConcern } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/$areaSlug/$categorySlug/$concernSlug")({
  loader: ({ params }) => getOilGuideConcern({
    data: {
      areaSlug: params.areaSlug,
      categorySlug: params.categorySlug,
      concernSlug: params.concernSlug,
    },
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.data.concern ? loaderData.data.concern.nameFa + " | راهنمای روغن شاهو" : "موضوع راهنما | شاهو" },
      { name: "description", content: loaderData?.data.concern?.description || "موضوعات راهنمای روغن شاهو." },
    ],
  }),
  component: ConcernPage,
});

function ConcernPage() {
  const result = Route.useLoaderData();
  return <OilGuideConcernPage status={result.status} concern={result.data.concern} oils={result.data.oils} />;
}
