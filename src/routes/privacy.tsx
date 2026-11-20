import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

export const Route = createFileRoute("/privacy")({
  loader: async () => {
    const page = await getPage({ data: { slug: "privacy" } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.seoTitle ?? "حریم خصوصی" }, { name: "description", content: loaderData?.seoDescription ?? "" }],
    links: loaderData ? canonicalLink(loaderData.origin, `/${loaderData.slug}`) : [],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <ContentPage page={Route.useLoaderData()} />;
}
