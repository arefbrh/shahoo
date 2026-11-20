import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

export const Route = createFileRoute("/pages/$pageSlug")({
  loader: async ({ params }) => {
    const page = await getPage({ data: { slug: params.pageSlug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.seoTitle || loaderData?.title || "شاهو" },
      { name: "description", content: loaderData?.seoDescription ?? "" },
    ],
    links: loaderData ? canonicalLink(loaderData.origin, `/pages/${loaderData.slug}`) : [],
  }),
  component: CmsPageRoute,
});

function CmsPageRoute() {
  const page = Route.useLoaderData();
  return <ContentPage page={page} path={`/pages/${page.slug}`} />;
}
