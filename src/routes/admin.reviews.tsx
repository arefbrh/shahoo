import { createFileRoute } from "@tanstack/react-router";
import { AdminReviews } from "@/components/site/support-desk";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviewsPage,
});

function AdminReviewsPage() {
  return <AdminReviews />;
}
