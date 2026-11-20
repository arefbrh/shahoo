import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { dbSource, getPgPool, getPglite, getSql } from "@/lib/db";
import * as schema from "./schema";

/**
 * Typed Drizzle handle on the platform database.
 *
 * `@/lib/db` owns migrations and the PGLite fallback. Neon uses node-postgres
 * when `DATABASE_URL` is set. Preview uses the same embedded Postgres instance
 * as `getSql()`, exposed by `getPglite()`.
 */
export type AppDatabase = PgliteDatabase<typeof schema>;

const globalRef = globalThis as typeof globalThis & {
  __shahooDrizzle__?: AppDatabase;
};

export async function getDb(): Promise<AppDatabase> {
  await getSql();
  if (globalRef.__shahooDrizzle__) return globalRef.__shahooDrizzle__;

  if (dbSource === "neon") {
    const pool = await getPgPool();
    const db = drizzlePg(pool, { schema });
    globalRef.__shahooDrizzle__ = db as unknown as AppDatabase;
    return globalRef.__shahooDrizzle__;
  }

  const client = await getPglite();
  globalRef.__shahooDrizzle__ = drizzlePglite(client, { schema });
  return globalRef.__shahooDrizzle__;
}
