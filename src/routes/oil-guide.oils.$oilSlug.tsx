import { createFileRoute, notFound } from "@tanstack/react-router";
import { OilGuideOilProfilePage } from "@/components/site/oil-guide-discovery";
import { getOilGuideOilProfile } from "@/server/oil-guide/api";

export const Route = createFileRoute("/oil-guide/oils/$oilSlug")({
  loader: async ({ params }) => {
    const result = await getOilGuideOilProfile({ data: { oilSlug: params.oilSlug } });
    if (result.status === "ready" && !result.data.profile) throw notFound();
    return result;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.data.profile ? String(loaderData.data.profile.name_fa || loaderData.data.profile.name_en) + " | دانشنامه روغن شاهو" : "پروفایل روغن | شاهو" },
      { name: "description", content: "اطلاعات تأییدشده و قابل انتشار دانشنامه روغن شاهو." },
    ],
  }),
  component: OilProfilePage,
});

function OilProfilePage() {
  const result = Route.useLoaderData();
  return (
    <OilGuideOilProfilePage
      status={result.status}
      profile={result.data.profile}
      claims={result.data.claims}
      protocols={result.data.protocols}
      faqs={result.data.faqs}
      qa={result.data.qa}
      warnings={result.data.warnings}
    />
  );
}
