import assert from "node:assert/strict";
import test from "node:test";
import { isOilEncyclopediaEnabled } from "./client.ts";

test("oil encyclopedia remains disabled unless explicitly enabled", () => {
  assert.equal(isOilEncyclopediaEnabled({}), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "false" }), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "1" }), false);
  assert.equal(isOilEncyclopediaEnabled({ OIL_ENCYCLOPEDIA_ENABLED: "true" }), true);
});
