import { ContactLines } from "@/components/site/contact-lines";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ContentPage } from "@/components/site/content-page";
import { canonicalLink } from "@/lib/seo";
import { getPage } from "@/server/storefront/api";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/returns")({
  loader: async () => {
    const page = await getPage({ data: { slug: "returns" } });
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.seoTitle ?? "بازگشت کالا" }, { name: "description", content: loaderData?.seoDescription ?? "" }],
    links: loaderData ? canonicalLink(loaderData.origin, `/${loaderData.slug}`) : [],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const page = Route.useLoaderData();
  const { profile } = rootRoute.useLoaderData();
  return <>
    {page && <ContentPage page={page} />}
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      {page ? <h2>پیگیری تلفنی مرجوعی</h2> : <h1>مرجوعی تلفنی</h1>}
      {profile.returnInstructions && <p className="whitespace-pre-line">{profile.returnInstructions}</p>}
      {profile.supportHours && <p>{profile.supportHours}</p>}
      <ContactLines profile={profile} />
    </section>
  </>;
}
