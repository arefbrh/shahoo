import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/magazine")({
  component: MagazineLayout,
});

export function MagazineLayout() {
  return <Outlet />;
}
