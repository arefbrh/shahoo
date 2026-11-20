import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { parseAddress, type AddressValue } from "@/lib/address-rules";
import { writeAudit } from "../auth/audit";
import { requireCustomer, SessionError } from "../auth/guard";
import type { AppDatabase } from "../db/client";
import { customerAddresses, customers } from "../db/schema";

export type AddressRow = AddressValue & {
  id: string;
  isDefault: boolean;
};

function toRow(row: typeof customerAddresses.$inferSelect): AddressRow {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipientName,
    recipientMobile: row.recipientMobile,
    province: row.province,
    city: row.city,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    plaque: row.plaque,
    unit: row.unit,
    isDefault: row.isDefault,
  };
}

export async function listAddresses(db: AppDatabase, customerId: string): Promise<AddressRow[]> {
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
  return rows.map(toRow);
}

async function lockCustomer(tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0], customerId: string) {
  const [row] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update").limit(1);
  return row ?? null;
}

export async function saveAddress(
  db: AppDatabase,
  customerId: string,
  input: AddressValue & { id?: string | null },
): Promise<{ ok: true; addresses: AddressRow[] } | { ok: false; message: string }> {
  const parsed = parseAddress(input);
  if (!parsed.ok) return parsed;
  const now = new Date();
  return db.transaction(async (tx) => {
    if (!(await lockCustomer(tx, customerId))) return { ok: false as const, message: "حساب کاربری پیدا نشد." };
    const owned = input.id
      ? (
          await tx
            .select()
            .from(customerAddresses)
            .where(and(eq(customerAddresses.id, input.id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
            .limit(1)
        )[0]
      : null;
    if (input.id && !owned) return { ok: false as const, message: "این نشانی برای حساب شما نیست." };
    const existing = await tx
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    const makeDefault = Boolean(owned?.isDefault) || existing.length === 0;
    if (makeDefault) {
      await tx
        .update(customerAddresses)
        .set({ isDefault: false, updatedAt: now })
        .where(and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    }
    if (owned) {
      await tx
        .update(customerAddresses)
        .set({ ...parsed.value, isDefault: makeDefault, updatedAt: now })
        .where(and(eq(customerAddresses.id, owned.id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    } else {
      await tx.insert(customerAddresses).values({
        id: `addr-${crypto.randomUUID()}`,
        customerId,
        ...parsed.value,
        isDefault: makeDefault,
      });
    }
    await writeAudit(tx, {
      actorType: "customer",
      actorId: customerId,
      action: owned ? "address.updated" : "address.created",
      entityType: "customer_address",
      entityId: owned?.id ?? customerId,
      metadata: { province: parsed.value.province },
    });
    const rows = await listAddresses(tx as unknown as AppDatabase, customerId);
    return { ok: true as const, addresses: rows };
  });
}

export async function removeAddress(db: AppDatabase, customerId: string, id: string) {
  return db.transaction(async (tx) => {
    if (!(await lockCustomer(tx, customerId))) return { ok: false as const, message: "حساب کاربری پیدا نشد." };
    const [owned] = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
      .limit(1);
    if (!owned) return { ok: false as const, message: "این نشانی برای حساب شما نیست." };
    const now = new Date();
    await tx
      .update(customerAddresses)
      .set({ deletedAt: now, isDefault: false, updatedAt: now })
      .where(and(eq(customerAddresses.id, owned.id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    if (owned.isDefault) {
      const [next] = await tx
        .select()
        .from(customerAddresses)
        .where(and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
        .orderBy(asc(customerAddresses.createdAt), asc(customerAddresses.id))
        .limit(1);
      if (next) await tx.update(customerAddresses).set({ isDefault: true, updatedAt: now }).where(eq(customerAddresses.id, next.id));
    }
    await writeAudit(tx, { actorType: "customer", actorId: customerId, action: "address.deleted", entityType: "customer_address", entityId: owned.id });
    return { ok: true as const, addresses: await listAddresses(tx as unknown as AppDatabase, customerId) };
  });
}

export async function setDefaultAddress(db: AppDatabase, customerId: string, id: string) {
  return db.transaction(async (tx) => {
    if (!(await lockCustomer(tx, customerId))) return { ok: false as const, message: "حساب کاربری پیدا نشد." };
    const [owned] = await tx
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
      .limit(1);
    if (!owned) return { ok: false as const, message: "این نشانی برای حساب شما نیست." };
    const now = new Date();
    await tx
      .update(customerAddresses)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    await tx
      .update(customerAddresses)
      .set({ isDefault: true, updatedAt: now })
      .where(and(eq(customerAddresses.id, owned.id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)));
    await writeAudit(tx, { actorType: "customer", actorId: customerId, action: "address.default_changed", entityType: "customer_address", entityId: owned.id });
    return { ok: true as const, addresses: await listAddresses(tx as unknown as AppDatabase, customerId) };
  });
}

export async function ownedAddress(db: AppDatabase, customerId: string, id: string): Promise<AddressRow | null> {
  const [row] = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId), isNull(customerAddresses.deletedAt)))
    .limit(1);
  return row ? toRow(row) : null;
}

function fail(error: unknown): { ok: false; message: string } {
  if (error instanceof SessionError) return { ok: false, message: error.message };
  return { ok: false, message: "ذخیره نشانی انجام نشد." };
}

export async function customerAddressesForSession() {
  try {
    const { db, customer } = await requireCustomer();
    return { ok: true as const, addresses: await listAddresses(db, customer.id) };
  } catch (error) {
    return fail(error);
  }
}

export async function saveAddressForSession(input: AddressValue & { id?: string | null }) {
  try {
    const { db, customer } = await requireCustomer();
    return await saveAddress(db, customer.id, input);
  } catch (error) {
    return fail(error);
  }
}

export async function removeAddressForSession(id: string) {
  try {
    const { db, customer } = await requireCustomer();
    return await removeAddress(db, customer.id, id);
  } catch (error) {
    return fail(error);
  }
}

export async function setDefaultAddressForSession(id: string) {
  try {
    const { db, customer } = await requireCustomer();
    return await setDefaultAddress(db, customer.id, id);
  } catch (error) {
    return fail(error);
  }
}
