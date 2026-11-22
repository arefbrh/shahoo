import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CatalogDesk } from "@/components/site/catalog-desk";
import { AdminDenied } from "@/components/site/admin-shell";
import { AdminHelp } from "@/components/site/admin-help";

const parent = getRouteApi("/admin");

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const session = parent.useLoaderData();
  if (!session.authenticated) return null;
  if (!session.permissions.includes("catalog.read")) return <AdminDenied message="این بخش برای نقش شما باز نیست." />;
  return (
    <div>
      <h1 className="text-3xl font-bold text-forest">کاتالوگ</h1><AdminHelp title="کاتالوگ" example="ابتدا دسته «روغن‌های گیاهی» را با شناسه herbal-oils بسازید؛ سپس محصول و حداقل یک بسته با SKU یکتا و قیمت تومان تعریف کنید.">کاتالوگ محل مدیریت دسته‌بندی، مشخصات محصول، بسته‌ها، قیمت و تصاویر محصول است. قیمت قابل پرداخت را در بسته (Variant) تغییر دهید، نه در متن معرفی یا بنر. برای انتشار محصول حداقل یک بسته فعال و اطلاعات ضروری کامل لازم است؛ موجودی فیزیکی را از بخش «موجودی» اصلاح کنید.</AdminHelp>
      <CatalogDesk
        canWrite={session.permissions.includes("catalog.write")}
        canInventory={session.permissions.includes("inventory.write")}
      />
    </div>
  );
}
