import assert from "node:assert/strict";
import test from "node:test";
import {
  attachCommerceMetadata,
  buildRecommendationCandidatePool,
  rankOilRecommendations,
} from "../src/server/oil-encyclopedia/recommendation-engine.mjs";

function fixtureOils(count = 41) {
  return Array.from({ length: count }, (_, index) => ({
    oil_id: `OIL-${String(index + 1).padStart(3, "0")}`,
    oil_name_fa: `روغن آزمایشی ${index + 1}`,
    oil_name_en: `Test oil ${index + 1}`,
    recommendation_eligible: true,
    safety_decision: "eligible",
    concern_ids: [index < 3 ? "concern-hair" : "concern-skin"],
    category_ids: [index < 3 ? "category-hair" : "category-skin"],
    area_slugs: [index < 3 ? "hair" : "skin"],
    texture: index % 2 ? "light" : "rich",
    evidence_levels: ["reviewed"],
    safety_warnings: [],
  }));
}

test("all 41 canonical oils remain in the candidate pool when the store has only three mapped products", () => {
  const canonicalOils = fixtureOils(41);
  const storefrontProducts = [
    { oilId: "OIL-001", slug: "oil-one", inStock: true },
    { oilId: "OIL-002", slug: "oil-two", inStock: false },
    { oilId: "OIL-003", slug: "oil-three", inStock: true },
  ];
  const commerceByOil = new Map(storefrontProducts.map((product) => [
    product.oilId,
    { availability: product.inStock ? "available" : "out_of_stock", productHref: `/product/${product.slug}` },
  ]));

  const candidates = buildRecommendationCandidatePool(canonicalOils);
  assert.equal(storefrontProducts.length, 3);
  assert.equal(candidates.length, 41);
  assert.deepEqual(candidates.map((candidate) => candidate.oilId), canonicalOils.map((oil) => oil.oil_id));
  assert.ok(candidates.some((candidate) => candidate.oilId === "OIL-041"));
  assert.ok(candidates.slice(3).every((candidate) => !commerceByOil.has(candidate.oilId)));

  const answers = { areaSlugs: ["hair"], categoryIds: ["category-hair"], concernIds: ["concern-hair"], texture: "" };
  const rankedWithoutCommerce = rankOilRecommendations(candidates, answers);
  const rankedWithThreeProducts = attachCommerceMetadata(rankOilRecommendations(candidates, answers), commerceByOil);
  assert.equal(rankedWithThreeProducts.length, 3);
  assert.deepEqual(
    rankedWithThreeProducts.map(({ oilId, score }) => [oilId, score]),
    rankedWithoutCommerce.map(({ oilId, score }) => [oilId, score]),
  );
  assert.equal(rankedWithThreeProducts[0].commerce.availability, "available");
});

test("candidate pool deduplicates repeated concern mappings by canonical oil ID", () => {
  const candidates = buildRecommendationCandidatePool([
    { oil_id: "OIL-001", recommendation_eligible: true, safety_decision: "eligible", concern_ids: ["C-1"] },
    { oil_id: "OIL-001", recommendation_eligible: true, safety_decision: "eligible", concern_ids: ["C-2"] },
  ]);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].concernIds, ["C-1", "C-2"]);
});

test("safety is a hard gate and a caution decision requires an approved warning", () => {
  const rows = fixtureOils(4);
  rows[0].safety_decision = "excluded";
  rows[1].safety_decision = "needs_review";
  rows[2].safety_decision = "eligible_with_caution";
  rows[2].safety_warnings = [];
  const candidates = buildRecommendationCandidatePool(rows);
  const results = rankOilRecommendations(candidates, {
    areaSlugs: ["hair"],
    categoryIds: ["category-hair"],
    concernIds: ["concern-hair"],
  });
  assert.deepEqual(results, []);
});

test("missing attributes never count as a positive match", () => {
  const rows = fixtureOils(4);
  rows[0].concern_ids = [];
  rows[0].category_ids = [];
  rows[0].area_slugs = [];
  rows[1].recommendation_eligible = false;
  rows[2].oil_name_fa = "";
  rows[3].safety_decision = "eligible";
  const results = rankOilRecommendations(buildRecommendationCandidatePool(rows), {
    areaSlugs: ["hair"],
    categoryIds: ["category-hair"],
    concernIds: ["concern-hair"],
  });
  assert.deepEqual(results, []);
});

test("scores are explainable, deterministic, and limited to three unique oils", () => {
  const candidates = buildRecommendationCandidatePool(fixtureOils(8));
  const answers = { areaSlugs: ["hair"], categoryIds: ["category-hair"], concernIds: ["concern-hair"], texture: "rich" };
  const first = rankOilRecommendations(candidates, answers);
  const second = rankOilRecommendations(candidates, answers);
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((item) => item.oilId), second.map((item) => item.oilId));
  assert.deepEqual(first.map((item) => item.score), [100, 100, 100]);
  assert.ok(first.every((item) => item.reasonCodes.length > 0 && item.breakdown.length === 4));
  assert.equal(new Set(first.map((item) => item.oilId)).size, 3);
});

test("fewer than three legitimately eligible matches are not padded", () => {
  const rows = fixtureOils(41).map((row, index) => ({
    ...row,
    recommendation_eligible: index < 2,
  }));
  const results = rankOilRecommendations(buildRecommendationCandidatePool(rows), {
    areaSlugs: ["hair"],
    categoryIds: ["category-hair"],
    concernIds: ["concern-hair"],
  });
  assert.deepEqual(results, []);
});
