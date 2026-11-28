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
  assert.match(ddl, /recommendation_status TEXT NOT NULL DEFAULT 'pending'/);

  assert.match(ddl, /name_fa TEXT/);
  assert.match(ddl, /evidence_levels TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::text\[\]/);
  assert.match(ddl, /review_note TEXT NOT NULL DEFAULT ''/);
  assert.match(ddl, /name_fa IS NOT NULL AND btrim\(name_fa\) <> ''/);

  const candidateView = ddl.split("CREATE VIEW oil_encyclopedia.public_guide_recommendation_candidates AS")[1]?.split("GRANT SELECT ON")[0] ?? "";
  assert.doesNotMatch(candidateView, /oil_product_links|product_variants|inventory|oil_encyclopedia\.products/i);
  assert.doesNotMatch(candidateView, /public_oil_profiles|oil_encyclopedia\.oil_profiles/i);
  assert.match(candidateView, /FROM oil_encyclopedia\.oil_guide_mappings m/);
  assert.match(candidateView, /JOIN oil_encyclopedia\.public_problem_oils approved_map/);
  assert.match(candidateView, /n\.category_id = m\.category_id/);
  assert.match(candidateView, /recommendation_candidate_eligible/);
  assert.match(candidateView, /customer_display_approved/);
  assert.match(candidateView, /recommendation_eligible/);


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

test("candidate relationships require active concerns and published snapshots carry provenance", () => {
  const ddl = buildImportDdl("CREATE TABLE oils (oil_id TEXT PRIMARY KEY);");
  const candidates = ddl.split("CREATE VIEW oil_encyclopedia.public_guide_recommendation_candidates AS")[1];
  assert.match(candidates, /JOIN oil_encyclopedia\.guide_concerns n[\s\S]*?n\.is_active IS TRUE/);
  assert.match(ddl, /NULLIF\(btrim\(source_version\), ''\) IS NOT NULL/);
  assert.match(ddl, /NULLIF\(btrim\(source_record_ref\), ''\) IS NOT NULL/);
});

test("imported recommendation views enforce provenance and withdraw deactivated concerns", async (t) => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  t.after(() => db.close());
  const source = [
    "CREATE TABLE oils (oil_id text PRIMARY KEY, name_fa text, name_en text, scientific_name text, inci_name text, other_names text[], oil_kind text, texture text);",
    "CREATE TABLE applications (app_id text PRIMARY KEY);",
    "CREATE TABLE problems (problem_id text PRIMARY KEY, name_fa text);",
    "CREATE TABLE problem_oil_map (map_id text PRIMARY KEY, oil_id text, app_id text, problem_id text, evidence_level text, show_usage_method boolean);",
    "CREATE TABLE warning_fixture (oil_id text, customer_text text);",
    "CREATE VIEW public_oil_profiles AS SELECT * FROM oils WHERE false;",
    "CREATE VIEW public_problem_oils AS SELECT * FROM problem_oil_map;",
    "CREATE VIEW public_safety_warnings AS SELECT * FROM warning_fixture;",
    "CREATE ROLE shahoo_web_reader NOLOGIN;",
    "GRANT SELECT ON public_oil_profiles, public_problem_oils, public_safety_warnings TO shahoo_web_reader;",
  ].join("\n");
  await db.exec(buildImportDdl(source));
  await db.exec(`
    SET search_path TO oil_encyclopedia, public;
    INSERT INTO oils(oil_id) SELECT 'test-' || i FROM generate_series(1, 41) AS i;
    INSERT INTO guide_recommendation_reviews(oil_id) SELECT oil_id FROM oils;
    INSERT INTO applications VALUES ('a');
    INSERT INTO guide_areas(id, slug, name_en, name_fa) VALUES ('hair','hair','Hair','مو');
    INSERT INTO guide_categories(id, area_id, slug, name_fa) VALUES ('cat','hair','cat','دسته');
    INSERT INTO guide_concerns(id, category_id, source_app_id, slug, name_fa, review_status,
      display_status, reviewed_by, reviewed_at) VALUES ('n','cat','a','n','نمونه','approved','published','tester',now());
    INSERT INTO problem_oil_map(map_id, oil_id, app_id) VALUES ('m','test-25','a');
    INSERT INTO oil_guide_mappings(id, oil_id, category_id, concern_id, supporting_record_type,
      supporting_record_id, review_status, display_status, reviewed_by, reviewed_at)
      VALUES ('m','test-25','cat','n','problem_oil_map','m','approved','published','tester',now());
  `);
  const eligible = async () => (await db.query(`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE recommendation_eligible)::int AS eligible
    FROM public_guide_recommendation_candidates
  `)).rows[0];
  assert.deepEqual(await eligible(), {total: 41, eligible: 0});
  const publish = `UPDATE guide_recommendation_reviews SET review_status='approved', recommendation_status='eligible',
    safety_decision='eligible', display_status='published', name_fa='نمونه', reviewed_by='tester', reviewed_at=now()
    WHERE oil_id='test-25'`;
  await assert.rejects(db.exec(publish), {code: "23514"});
  await db.exec("UPDATE guide_recommendation_reviews SET source_version='fixture', source_record_ref='test-25', review_note='synthetic test' WHERE oil_id='test-25'");
  await db.exec(publish);
  assert.deepEqual(await eligible(), {total: 41, eligible: 1});
  await db.exec("UPDATE guide_concerns SET is_active=false WHERE id='n'");
  assert.deepEqual(await eligible(), {total: 41, eligible: 0});
});
