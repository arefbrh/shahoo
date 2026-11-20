import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema.ts";
import { adminPermissions, adminRolePermissions, adminRoles } from "./schema.ts";

export const ACCESS_PERMISSIONS = [
  ["catalog.read", "مشاهده کاتالوگ"],
  ["catalog.write", "ویرایش محصولات و دسته‌ها"],
  ["inventory.read", "مشاهده موجودی"],
  ["inventory.write", "اصلاح موجودی"],
  ["orders.read", "مشاهده سفارش‌ها"],
  ["orders.write", "تغییر وضعیت سفارش"],
  ["customers.read", "مشاهده مشتریان"],
  ["customers.write", "تغییر وضعیت مشتری"],
  ["content.write", "ویرایش محتوای سایت"],
  ["settings.read", "مشاهده تخفیف و ارسال"],
  ["settings.write", "تنظیمات فروشگاه"],
  ["admins.read", "مشاهده مدیران"],
  ["admins.write", "مدیریت مدیران"],
  ["reports.read", "گزارش فروش"],
  ["support.write", "پاسخ و بستن درخواست پشتیبانی"],
] as const;

export const ACCESS_ROLES = [
  ["super_admin", "مدیر ارشد", "دسترسی کامل", ACCESS_PERMISSIONS.map(([key]) => key)],
  ["product_manager", "مدیر محصول", "کاتالوگ و موجودی", ["catalog.read", "catalog.write", "inventory.read", "inventory.write"]],
  ["order_manager", "مدیر سفارش", "سفارش و ارسال", ["orders.read", "orders.write", "customers.read", "settings.read", "support.write"]],
  ["content_manager", "مدیر محتوا", "صفحات، بنر و مجله", ["content.write", "catalog.read"]],
  ["customer_support", "پشتیبانی", "مشاهده سفارش و مشتری", ["orders.read", "customers.read", "catalog.read", "support.write"]],
] as const;

export async function seedAccessControl(tx: Pick<PgliteDatabase<typeof schema>, "insert">): Promise<void> {
  await tx.insert(adminPermissions).values(
    ACCESS_PERMISSIONS.map(([key, description]) => ({ id: `perm-${key}`, key, description })),
  ).onConflictDoNothing();
  await tx.insert(adminRoles).values(
    ACCESS_ROLES.map(([key, name, description]) => ({ id: `role-${key}`, key, name, description })),
  ).onConflictDoNothing();
  await tx.insert(adminRolePermissions).values(
    ACCESS_ROLES.flatMap(([key, , , perms]) => perms.map((perm) => ({ roleId: `role-${key}`, permissionId: `perm-${perm}` }))),
  ).onConflictDoNothing();
}
