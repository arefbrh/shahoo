import { createFileRoute } from "@tanstack/react-router";
import { CustomerView } from "@/components/site/admin-pages";
import { getCustomerFn } from "@/server/admin/api";

export const Route = createFileRoute("/admin/customers/$customerId")({
  loader: ({ params }) => getCustomerFn({ data: { id: params.customerId } }),
  component: CustomerPage,
});

function CustomerPage() {
  return <CustomerView data={Route.useLoaderData()} />;
}
