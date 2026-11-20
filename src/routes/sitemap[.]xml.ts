import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "@/lib/seo";
import { requestOrigin } from "@/server/seo/origin";
import { publicPaths } from "@/server/seo/paths";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = sitemapXml(requestOrigin(), await publicPaths());
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
