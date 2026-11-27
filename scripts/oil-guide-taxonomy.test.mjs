import assert from "node:assert/strict";
import test from "node:test";
import { buildImportDdl } from "./import-oil-encyclopedia.mjs";

test("v3.2 importer adds a normalized, isolated Oil Guide taxonomy", () => {
  const source = [
    "-- SHAHOO Oil Encyclopedia v3.1",
    "CREATE TABLE oils (oil_id TEXT PRIMARY KEY);",
    "CREATE TABLE applications (app_id TEXT PRIMARY KEY);",
    "CREATE TABLE problem_oil_map (map_id TEXT PRIMARY KEY, oil_id TEXT, app_id TEXT);",
    "CREATE VIEW public_oil_profiles AS SELECT oil_id FROM oils;",
    "CREATE VIEW public_problem_oils AS SELECT map_id, oil_id FROM problem_oil_map;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shahoo_web_reader') THEN CREATE ROLE shahoo_web_reader NOLOGIN; END IF; END $$;",
    "GRANT SELECT ON public_oil_profiles, public_problem_oils TO shahoo_web_reader;",
  ].join("\n");

  const ddl = buildImportDdl(source);
  assert.match(ddl, /CREATE SCHEMA IF NOT EXISTS oil_encyclopedia/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.guide_areas/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.guide_categories/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.guide_concerns/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.oil_guide_mappings/);
  assert.match(ddl, /REFERENCES oil_encyclopedia\.problem_oil_map\(map_id\)/);
  assert.match(ddl, /CREATE VIEW oil_encyclopedia\.public_guide_oils/);
  assert.match(ddl, /CREATE VIEW oil_encyclopedia\.public_guide_areas/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.guide_recommendation_reviews/);
  assert.match(ddl, /CREATE VIEW oil_encyclopedia\.public_guide_questionnaire_concerns/);
  assert.match(ddl, /CREATE VIEW oil_encyclopedia\.public_guide_recommendation_candidates/);
  assert.match(ddl, /FROM oil_encyclopedia\.oils o/);
  assert.match(ddl, /LEFT JOIN oil_encyclopedia\.guide_recommendation_reviews r/);
  assert.match(ddl, /safety_decision IN \('eligible','eligible_with_caution'\)/);
  assert.match(ddl, /display_status TEXT NOT NULL DEFAULT 'hidden'/);
  const candidateView = ddl.split("CREATE VIEW oil_encyclopedia.public_guide_recommendation_candidates AS")[1]?.split("GRANT SELECT ON")[0] ?? "";
  assert.doesNotMatch(candidateView, /oil_product_links|product_variants|inventory|oil_encyclopedia\.products/i);
  assert.doesNotMatch(candidateView, /public_oil_profiles|oil_encyclopedia\\.oil_profiles/i);
  assert.match(candidateView, /FROM oil_encyclopedia\.oil_guide_mappings m/);

  assert.match(ddl, /TO shahoo_oil_encyclopedia_reader/);
  assert.match(ddl, /review_status TEXT NOT NULL DEFAULT 'needs_human_review'/);
  assert.match(ddl, /display_status TEXT NOT NULL DEFAULT 'hidden'/);
  assert.match(ddl, /display_status <> 'published' OR \(review_status = 'approved'/);
  assert.doesNotMatch(ddl, /GRANT SELECT ON ALL TABLES IN SCHEMA oil_encyclopedia TO shahoo_oil_encyclopedia_reader/i);
});

test("Oil Guide public mapping view requires both human mapping approval and approved encyclopedia views", () => {
  const ddl = buildImportDdl("CREATE TABLE oils (oil_id TEXT PRIMARY KEY); CREATE VIEW public_oil_profiles AS SELECT oil_id FROM oils;");
  assert.match(ddl, /m\.review_status = 'approved'/);
  assert.match(ddl, /m\.display_status = 'published'/);
  assert.match(ddl, /JOIN oil_encyclopedia\.public_problem_oils approved_map/);
  assert.match(ddl, /JOIN oil_encyclopedia\.public_oil_profiles oil/);
  assert.match(ddl, /m\.reviewed_by IS NOT NULL/);
  assert.match(ddl, /m\.reviewed_at IS NOT NULL/);
});
