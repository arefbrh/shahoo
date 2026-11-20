import { createFileRoute } from "@tanstack/react-router";
import { handleMediaUpload } from "@/server/media/upload-request";

export const Route = createFileRoute("/api/media-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMediaUpload(request),
    },
  },
});
