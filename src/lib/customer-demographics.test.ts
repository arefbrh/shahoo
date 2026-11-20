import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demographicDistribution } from "./customer-demographics.ts";

describe("customer demographic aggregation", () => {
  it("uses only non-empty values as the percentage denominator and reports missing separately", () => {
    assert.deepEqual(demographicDistribution([
      { value: "female", count: 2 },
      { value: "male", count: 1 },
      { value: "prefer_not_to_say", count: 1 },
    ], 10, "gender"), {
      answered: 4,
      missing: 6,
      categories: [
        { label: "زن", value: "2 (50%)" },
        { label: "مرد", value: "1 (25%)" },
        { label: "ترجیح می‌دهم نگویم", value: "1 (25%)" },
      ],
    });
  });

  it("does not invent category rows when no optional answers exist", () => {
    assert.deepEqual(demographicDistribution([], 3, "ageGroup"), { answered: 0, missing: 3, categories: [] });
  });

  it("ignores unknown and non-positive categories", () => {
    assert.deepEqual(demographicDistribution([
      { value: "female", count: 1 },
      { value: "unexpected", count: 10 },
      { value: "male", count: 0 },
    ], 11, "gender"), {
      answered: 1,
      missing: 10,
      categories: [{ label: "زن", value: "1 (100%)" }],
    });
  });
});
