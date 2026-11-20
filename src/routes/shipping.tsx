import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

export const Route = createFileRoute("/shipping")({
  loader: async () => {
    const page = await getPage({ data: { slug: "shipping" } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.seoTitle ?? "ارسال" }, { name: "description", content: loaderData?.seoDescription ?? "" }],
    links: loaderData ? canonicalLink(loaderData.origin, `/${loaderData.slug}`) : [],
  }),
  component: ShippingPage,
});

function ShippingPage() {
  return <ContentPage page={Route.useLoaderData()} />;
}
