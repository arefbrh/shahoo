#!/usr/bin/env node
/** Scheduled maintenance entry point. Run with the production service environment. */
import { openDb } from "../src/server/auth/db.ts";
import { releaseExpiredHolds } from "../src/server/commerce/holds.ts";

try {
  const db = await openDb();
  const released = await releaseExpiredHolds(db);
  console.log(`[maintenance] expired inventory holds released: ${released}`);
} catch (error) {
  console.error("[maintenance] expired-hold release failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
