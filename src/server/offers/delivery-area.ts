import { like } from "drizzle-orm";
import type { DeliveryArea } from "../../lib/public-shipping";
import type { AppDatabase } from "../db/client";
import { settings } from "../db/schema";

const prefix = "shipping.area.";
export const deliveryAreaKey = (id: string) => prefix + id;

export async function deliveryAreas(db: Pick<AppDatabase, "select">) {
  const rows = await db.select().from(settings).where(like(settings.key, prefix + "%"));
  return new Map(rows.map(({ key, value }) => [key.slice(prefix.length), value as DeliveryArea]));
}
