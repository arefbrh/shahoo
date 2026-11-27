import { createFileRoute } from "@tanstack/react-router";
import { OilGuideCategoryPage } from "@/components/site/oil-guide-discovery";
import { getOilGuideCategory } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/$areaSlug/$categorySlug")({
  loader: ({ params }) => getOilGuideCategory({ data: { areaSlug: params.areaSlug, categorySlug: params.categorySlug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.data.category ? loaderData.data.category.nameFa + " | راهنمای روغن شاهو" : "زیر‌دسته روغن | شاهو" },
      { name: "description", content: loaderData?.data.category?.seoDescription || loaderData?.data.category?.description || "زیر‌دسته‌بندی راهنمای روغن شاهو." },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const result = Route.useLoaderData();
  return (
    <OilGuideCategoryPage
      status={result.status}
      category={result.data.category}
      concerns={result.data.concerns}
      oils={result.data.oils}
    />
  );
}
