import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const checkType = url.searchParams.get("type"); // "live" | "ready" | null

        // 1. Liveness check: verify process responsiveness
        if (checkType === "live") {
          return new Response(
            JSON.stringify({
              status: "ok",
              check: "liveness",
              uptimeSeconds: Math.floor(process.uptime()),
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store, no-cache, must-revalidate",
              },
            },
          );
        }

        // 2. Readiness check (default or ?type=ready): verify process + DB connectivity
        try {
          const sql = await getSql();
          await sql`SELECT 1 as alive`;

          return new Response(
            JSON.stringify({
              status: "ok",
              check: "readiness",
              db: "connected",
              uptimeSeconds: Math.floor(process.uptime()),
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store, no-cache, must-revalidate",
              },
            },
          );
        } catch (error) {
          // Log internally for debugging, never leak database credentials or stack in response
          console.error("[Healthcheck Error] Database probe failed:", error instanceof Error ? error.message : error);

          return new Response(
            JSON.stringify({
              status: "degraded",
              check: "readiness",
              error: "database_unavailable",
              timestamp: new Date().toISOString(),
            }),
            {
              status: 503,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store, no-cache, must-revalidate",
              },
            },
          );
        }
      },
    },
  },
});
