import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { OilGuideAreaPage } from "@/components/site/oil-guide-discovery";
import { getOilGuideArea } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/$areaSlug")({
  loader: async ({ params }) => {
    const result = await getOilGuideArea({ data: { areaSlug: params.areaSlug } });
    if (result.status === "ready" && !result.data.area) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.data.area ? (loaderData.data.area.seoTitle || loaderData.data.area.nameFa + " | راهنمای روغن شاهو") : "دسته روغن | شاهو" },
      { name: "description", content: loaderData?.data.area?.seoDescription || loaderData?.data.area?.description || "دسته‌بندی‌های راهنمای روغن شاهو." },
    ],
  }),
  component: AreaPage,
});

function AreaPage() {
  const result = Route.useLoaderData();
  return (
    <>
      <OilGuideAreaPage status={result.status} area={result.data.area} categories={result.data.categories} oils={result.data.oils} />
      <Outlet />
    </>
  );
}
