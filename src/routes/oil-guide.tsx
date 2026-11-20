import { createFileRoute } from "@tanstack/react-router";
import { OilGuide } from "@/components/site/oil-guide";
import { canonicalLink } from "@/lib/seo";
import { listOilProducts } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/oil-guide")({
  loader: async () => {
    const [oils, origin] = await Promise.all([listOilProducts(), getSeoOrigin()]);
    return { oils, origin };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: "راهنمای روغن شاهو" }, { name: "description", content: "انتخاب روغن گیاهی شاهو بر اساس کاربرد، بافت و رایحه." }],
    links: canonicalLink(loaderData?.origin ?? "", "/oil-guide"),
  }),
  component: OilPage,
});

function OilPage() {
  const { oils } = Route.useLoaderData();
  return <OilGuide oils={oils} />;
}
