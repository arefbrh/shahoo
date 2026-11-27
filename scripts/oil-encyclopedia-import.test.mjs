import assert from "node:assert/strict";
import test from "node:test";
import { buildImportDdl, dataFileToTable, extractTableNames, extractViewNames, namespaceSchemaSql, normalizeTableRows } from "./import-oil-encyclopedia.mjs";

const sample = [
  "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
  "CREATE TABLE oils (oil_id TEXT PRIMARY KEY);",
  "CREATE TABLE scientific_sources (source_id TEXT PRIMARY KEY);",
  "CREATE TABLE claims (claim_id TEXT PRIMARY KEY, oil_id TEXT REFERENCES oils(oil_id));",
  "CREATE INDEX claims_oil_idx ON claims (oil_id);",
  "CREATE VIEW public_oil_profiles AS SELECT oil_id FROM oils JOIN claims USING (oil_id);",
  "CREATE VIEW public_problem_oils AS SELECT oil_id FROM oils LEFT JOIN public_oil_profiles USING (oil_id);",
  "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM shahoo_web_reader;",
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM shahoo_web_reader;",
  "GRANT USAGE ON SCHEMA public TO shahoo_web_reader;",
  "GRANT SELECT ON public_oil_profiles TO shahoo_web_reader;",
].join("\n");

test("v3.2 table and view discovery is deterministic", () => {
  assert.deepEqual(extractTableNames(sample), ["oils", "scientific_sources", "claims"]);
  assert.deepEqual(extractViewNames(sample), ["public_oil_profiles", "public_problem_oils"]);
});

test("DDL namespacing keeps encyclopedia relations isolated", () => {
  const ddl = namespaceSchemaSql(sample);
  assert.match(ddl, /CREATE SCHEMA IF NOT EXISTS oil_encyclopedia/);
  assert.match(ddl, /CREATE TABLE oil_encyclopedia\.oils/);
  assert.match(ddl, /REFERENCES oil_encyclopedia\.oils/);
  assert.match(ddl, /ON oil_encyclopedia\.claims/);
  assert.match(ddl, /CREATE VIEW oil_encyclopedia\.public_oil_profiles/);
  assert.match(ddl, /FROM oil_encyclopedia\.oils JOIN oil_encyclopedia\.claims/);
  assert.match(ddl, /ON SCHEMA oil_encyclopedia TO shahoo_oil_encyclopedia_reader/);
  assert.match(ddl, /IN SCHEMA oil_encyclopedia REVOKE ALL ON TABLES FROM shahoo_oil_encyclopedia_reader/);
  assert.match(ddl, /ALL TABLES IN SCHEMA oil_encyclopedia FROM shahoo_oil_encyclopedia_reader/);
  assert.match(ddl, /ON oil_encyclopedia\.public_oil_profiles TO shahoo_oil_encyclopedia_reader/);
  assert.match(ddl, /CREATE EXTENSION IF NOT EXISTS pg_trgm/);
});

test("active JSON filenames map to SQL table names", () => {
  assert.equal(dataFileToTable("Oil_Profiles.json"), "oil_profiles");
  assert.equal(dataFileToTable("FAQ.json"), "faq");
  assert.equal(dataFileToTable("SHAHOO_Product_Catalog.json"), "shahoo_product_catalog");
});

test("v3.2 import DDL reconciles the table_decisions JSON columns", () => {
  const ddl = buildImportDdl(sample.replace("CREATE TABLE oils", "-- SHAHOO Oil Encyclopedia v3.1\nCREATE TABLE oils"));
  assert.match(ddl, /SHAHOO Oil Encyclopedia v3.2/);
  assert.equal(ddl.includes("ALTER TABLE oil_encyclopedia.table_decisions ADD COLUMN"), false);
});

test("legacy Table_Decisions keys normalize to the v3.2 SQL columns", () => {
  const rows = normalizeTableRows("table_decisions", [
    { table_name: "active", rows_v3: 41, location_v31: "data/" },
    { table_name: "archive", row_count: 5, location: "archive/" },
  ]);
  assert.deepEqual(rows[1], {
    table_name: "archive",
    rows_v3: 5,
    location_v31: "archive/",
  });
  assert.deepEqual(normalizeTableRows("oils", [{ oil_id: "OIL-001" }]), [{ oil_id: "OIL-001" }]);
  assert.throws(
    () => normalizeTableRows("table_decisions", [{ rows_v3: 2, row_count: 3 }]),
    /Conflicting row_count and rows_v3/,
  );
});
