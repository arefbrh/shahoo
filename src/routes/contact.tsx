import { createFileRoute } from "@tanstack/react-router";
import { ContactForm } from "@/components/site/contact-form";
import { canonicalLink } from "@/lib/seo";
import { getShell } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const [shell, origin] = await Promise.all([getShell(), getSeoOrigin()]);
    return { shell, origin };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: "تماس با شاهو" }, { name: "description", content: "راه‌های ارتباط با فروشگاه شاهو." }],
    links: canonicalLink(loaderData?.origin ?? "", "/contact"),
  }),
  component: ContactRoute,
});

function ContactRoute() {
  const { shell } = Route.useLoaderData();
  return <ContactForm profile={shell.profile} />;
}
