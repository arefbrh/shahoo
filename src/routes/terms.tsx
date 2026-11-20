import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

export const Route = createFileRoute("/terms")({
  loader: async () => {
    const page = await getPage({ data: { slug: "terms" } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.seoTitle ?? "قوانین" }, { name: "description", content: loaderData?.seoDescription ?? "" }],
    links: loaderData ? canonicalLink(loaderData.origin, `/${loaderData.slug}`) : [],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <ContentPage page={Route.useLoaderData()} />;
}
