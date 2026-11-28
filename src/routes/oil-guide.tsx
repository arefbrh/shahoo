import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oil-guide")({
  component: OilGuideLayout,
});

function OilGuideLayout() {
  return <Outlet />;
}
