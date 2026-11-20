import { getDb, type AppDatabase } from "../db/client";
import { ensureSeed } from "../db/seed";

export async function openDb(): Promise<AppDatabase> {
  await ensureSeed();
  return getDb();
}

export function asTime(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
