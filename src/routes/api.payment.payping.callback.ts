import { createFileRoute } from "@tanstack/react-router";
import { handlePayPingCallback } from "@/server/payments/payping-lifecycle";

export const Route = createFileRoute("/api/payment/payping/callback")({
  server: {
    handlers: {
      POST: ({ request }) => handlePayPingCallback(request),
    },
  },
});
