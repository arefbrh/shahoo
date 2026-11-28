import { createFileRoute } from "@tanstack/react-router";
import { OilGuideQuestionnaire } from "@/components/site/oil-guide-questionnaire";
import { OilGuideLanding } from "@/components/site/oil-guide-discovery";
import { canonicalLink } from "@/lib/seo";
import { getOilGuideLanding } from "@/server/oil-guide/api";
import { getOilGuideQuestionnaire } from "@/server/oil-guide/recommendations-api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/oil-guide/")({
  loader: async () => {
    const [origin, discovery, questionnaire] = await Promise.all([
      getSeoOrigin(),
      getOilGuideLanding(),
      getOilGuideQuestionnaire(),
    ]);
    return { origin, discovery, questionnaire };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "راهنمای هوشمند روغن شاهو" },
      { name: "description", content: "پرسش‌نامه مرحله‌ای و پیشنهاد سه روغن بر اساس اطلاعات تأییدشده دانشنامه شاهو." },
    ],
    links: canonicalLink(loaderData?.origin ?? "", "/oil-guide"),
  }),
  component: OilPage,
});

function OilPage() {
  const { discovery, questionnaire } = Route.useLoaderData();
  return (
    <>
      <OilGuideQuestionnaire initialData={questionnaire} />
      <div className="border-t border-line bg-cream/30">
        <OilGuideLanding result={discovery} compact />
      </div>
    </>
  );
}
