import { createFileRoute } from "@tanstack/react-router";
import { generateTorobProductFeed } from "@/server/seo/torob-feed";

export const Route = createFileRoute("/api/torob/products")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const feed = await generateTorobProductFeed();
          return new Response(JSON.stringify(feed), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=600, s-maxage=1800",
            },
          });
        } catch (error) {
          const correlationId = crypto.randomUUID();
          console.error(`[torob-feed:${correlationId}]`, error);
          return new Response(JSON.stringify({ error: "feed_unavailable", correlationId }), {
            status: 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }
      },
    },
  },
});
