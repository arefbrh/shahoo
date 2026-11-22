import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { mediaAssets } from "@/server/db/schema";
import { objectNameForStorageKey, openStorage } from "@/server/media/storage";

export const Route = createFileRoute("/media/file/$assetId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.assetId;
        if (!/^med-[A-Za-z0-9-]{8,80}$/.test(id)) return new Response("not found", { status: 404 });
        const db = await getDb();
        const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
        if (!row || row.deletedAt) return new Response("not found", { status: 404 });
        const name = objectNameForStorageKey(row.storageKey);
        const storage = openStorage();
        if (!name || !storage) return new Response("not found", { status: 404 });
        let bytes: Uint8Array | null;
        try {
          bytes = await storage.read(name);
        } catch {
          return new Response("media storage unavailable", { status: 503 });
        }
        if (!bytes) return new Response("not found", { status: 404 });
        return new Response(Buffer.from(bytes), {
          headers: {
            "content-type": row.mimeType,
            "cache-control": "public, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
