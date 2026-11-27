import assert from "node:assert/strict";
import test from "node:test";
import { getApprovedOilKnowledge, isOilEncyclopediaEnabled } from "./client.ts";

test("oil encyclopedia remains disabled unless explicitly enabled", () => {
  assert.equal(isOilEncyclopediaEnabled({}), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "false" }), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "1" }), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "true" }), true);
});

test("enabled reader requires its own URL and never borrows the storefront URL", async () => {
  const oldEnabled = process.env.OIL_ENCYCLOPEDIA_ENABLED;
  const oldReaderUrl = process.env.OIL_ENCYCLOPEDIA_DATABASE_URL;
  const oldStorefrontUrl = process.env.DATABASE_URL;
  process.env.OIL_ENCYCLOPEDIA_ENABLED = "true";
  delete process.env.OIL_ENCYCLOPEDIA_DATABASE_URL;
  process.env.DATABASE_URL = "postgres://storefront-only.example/db";
  try {
    await assert.rejects(
      getApprovedOilKnowledge(["OIL-001"]),
      /OIL_ENCYCLOPEDIA_DATABASE_URL is missing/,
    );
  } finally {
    if (oldEnabled === undefined) delete process.env.OIL_ENCYCLOPEDIA_ENABLED;
    else process.env.OIL_ENCYCLOPEDIA_ENABLED = oldEnabled;
    if (oldReaderUrl === undefined) delete process.env.OIL_ENCYCLOPEDIA_DATABASE_URL;
    else process.env.OIL_ENCYCLOPEDIA_DATABASE_URL = oldReaderUrl;
    if (oldStorefrontUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldStorefrontUrl;
  }
});
