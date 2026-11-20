import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const page = await getPage({ data: { slug: "about" } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.seoTitle ?? "درباره شاهو" }, { name: "description", content: loaderData?.seoDescription ?? "" }],
    links: loaderData ? canonicalLink(loaderData.origin, `/${loaderData.slug}`) : [],
  }),
  component: AboutPage,
});

function AboutPage() {
  return <ContentPage page={Route.useLoaderData()} />;
}
