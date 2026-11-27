import { createFileRoute } from "@tanstack/react-router";
import { OilGuide } from "@/components/site/oil-guide";
import { OilGuideLanding } from "@/components/site/oil-guide-discovery";
import { canonicalLink } from "@/lib/seo";
import { listOilProducts } from "@/server/storefront/api";
import { getOilGuideLanding } from "@/server/oil-guide/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/oil-guide")({
  loader: async () => {
    const [oils, origin, discovery] = await Promise.all([
      listOilProducts(),
      getSeoOrigin(),
      getOilGuideLanding(),
    ]);
    return { oils, origin, discovery };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "راهنمای روغن شاهو" },
      { name: "description", content: "کشف روغن‌های گیاهی بر اساس ناحیه، موضوع و اطلاعات تأییدشده دانشنامه شاهو." },
    ],
    links: canonicalLink(loaderData?.origin ?? "", "/oil-guide"),
  }),
  component: OilPage,
});

function OilPage() {
  const { oils, discovery } = Route.useLoaderData();
  return (
    <>
      <OilGuideLanding result={discovery} />
      <section className="border-t border-line bg-cream/40">
        <div className="mx-auto max-w-5xl px-4 pt-10">
          <p className="text-xs font-bold text-gold">QUICK RECOMMENDATION</p>
          <h2 className="mt-2 text-2xl font-bold text-forest">انتخاب سریع روغن</h2>
          <p className="mt-2 text-sm leading-7 text-muted">اگر می‌خواهید با چند پرسش کوتاه از میان محصولات فعال فروشگاه انتخاب کنید، از راهنمای سریع زیر استفاده کنید.</p>
        </div>
        <OilGuide oils={oils} />
      </section>
    </>
  );
}
