import { createFileRoute } from "@tanstack/react-router";
import { OilGuideAreaPage } from "@/components/site/oil-guide-discovery";
import { getOilGuideArea } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/$areaSlug")({
  loader: ({ params }) => getOilGuideArea({ data: { areaSlug: params.areaSlug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.data.area ? loaderData.data.area.nameFa + " | راهنمای روغن شاهو" : "دسته روغن | شاهو" },
      { name: "description", content: loaderData?.data.area?.description || "دسته‌بندی‌های راهنمای روغن شاهو." },
    ],
  }),
  component: AreaPage,
});

function AreaPage() {
  const result = Route.useLoaderData();
  return <OilGuideAreaPage status={result.status} area={result.data.area} categories={result.data.categories} oils={result.data.oils} />;
}
