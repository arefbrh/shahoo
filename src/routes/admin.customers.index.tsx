import { createFileRoute } from "@tanstack/react-router";
import { CustomersView } from "@/components/site/admin-pages";
import { listCustomersFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/customers/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    page: Math.max(1, Number(search.page) || 1),
    status: typeof search.status === "string" ? search.status : "",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listCustomersFn({ data: deps }),
  component: CustomersPage,
});

function CustomersPage() {
  return <CustomersView data={Route.useLoaderData()} />;
}
