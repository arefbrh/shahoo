import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/components/site/home-view";
import { JsonLd } from "@/components/site/json-ld";
import { canonicalLink, organizationLd } from "@/lib/seo";
import { getHome } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [data, origin] = await Promise.all([getHome(), getSeoOrigin()]);
    return { data, origin };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "شاهو | محصولات طبیعی" },
      { name: "description", content: "فروشگاه محصولات طبیعی شاهو؛ روغن پرس سرد، کره مغزیجات و گیاهان دست‌چین." },
    ],
    links: canonicalLink(loaderData?.origin ?? "", "/"),
  }),
  component: HomePage,
});

function HomePage() {
  const { data, origin } = Route.useLoaderData();
  return (
    <>
      <JsonLd
        data={organizationLd({
          origin,
          name: "شاهو",
          description: "فروشگاه محصولات طبیعی شاهو؛ روغن پرس سرد، کره مغزیجات و گیاهان دست‌چین.",
        })}
      />
      <HomeView data={data} />
    </>
  );
}
