#!/usr/bin/env node
/**
 * One-time importer for the owner-supplied SHAHOO Oil Encyclopedia v3.2.
 * Separate from the storefront migrator. Requires an extracted source directory,
 * a dedicated import URL and explicit non-production target confirmation.
 * Never reads DATABASE_URL.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";

const SCHEMA = "oil_encyclopedia";
const EXPECTED_DATA_TABLES = 44;
const EXPECTED_DDL_TABLES = 47;
const EXPECTED_PUBLIC_VIEWS = 7;
const SKIP_FILES = new Set(["shahoo_oil_db.json", "validation_report.json"]);

const GUIDE_TAXONOMY_DDL = String.raw`
-- SHAHOO Oil Guide taxonomy v1. The taxonomy is stored beside the canonical
-- encyclopedia records; imported relationships are deliberately unpublished.
CREATE TABLE oil_encyclopedia.guide_areas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_fa TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE oil_encyclopedia.guide_categories (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES oil_encyclopedia.guide_areas(id),
  parent_id TEXT REFERENCES oil_encyclopedia.guide_categories(id),
  source_category TEXT UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT,
  name_fa TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE oil_encyclopedia.guide_concerns (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES oil_encyclopedia.guide_categories(id),
  source_app_id TEXT NOT NULL UNIQUE REFERENCES oil_encyclopedia.applications(app_id),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT,
  name_fa TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  review_status TEXT NOT NULL DEFAULT 'needs_human_review' CHECK (review_status IN ('needs_human_review','approved','rejected')),
  display_status TEXT NOT NULL DEFAULT 'hidden' CHECK (display_status IN ('hidden','published','disabled')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT guide_concern_review_check CHECK (
    review_status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT guide_concern_publish_check CHECK (
    display_status <> 'published' OR (review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE TABLE oil_encyclopedia.oil_guide_mappings (
  id TEXT PRIMARY KEY,
  oil_id TEXT NOT NULL REFERENCES oil_encyclopedia.oils(oil_id),
  category_id TEXT NOT NULL REFERENCES oil_encyclopedia.guide_categories(id),
  concern_id TEXT REFERENCES oil_encyclopedia.guide_concerns(id),
  supporting_record_type TEXT NOT NULL CHECK (supporting_record_type IN ('problem_oil_map')),
  supporting_record_id TEXT NOT NULL,
  relevance_type TEXT NOT NULL DEFAULT 'problem_oil_mapping',
  evidence_status TEXT NOT NULL DEFAULT 'unknown',
  review_status TEXT NOT NULL DEFAULT 'needs_human_review' CHECK (review_status IN ('needs_human_review','approved','rejected')),
  display_status TEXT NOT NULL DEFAULT 'hidden' CHECK (display_status IN ('hidden','published','disabled')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT oil_guide_mapping_review_check CHECK (
    review_status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT oil_guide_mapping_publish_check CHECK (
    display_status <> 'published' OR (review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  UNIQUE (supporting_record_type, supporting_record_id),
  CONSTRAINT oil_guide_mapping_support_fk FOREIGN KEY (supporting_record_id)
    REFERENCES oil_encyclopedia.problem_oil_map(map_id)
);
CREATE INDEX guide_categories_area_idx ON oil_encyclopedia.guide_categories(area_id, sort_order);
CREATE INDEX guide_concerns_category_idx ON oil_encyclopedia.guide_concerns(category_id, sort_order);
CREATE INDEX oil_guide_mappings_category_idx ON oil_encyclopedia.oil_guide_mappings(category_id, display_status, review_status);
CREATE INDEX oil_guide_mappings_oil_idx ON oil_encyclopedia.oil_guide_mappings(oil_id);

-- Recommendation review is intentionally separate from full profile publication.
-- Every canonical oil receives a pending review row during import; no oil is auto-approved.
CREATE TABLE oil_encyclopedia.guide_recommendation_reviews (
  oil_id TEXT PRIMARY KEY REFERENCES oil_encyclopedia.oils(oil_id),
  review_status TEXT NOT NULL DEFAULT 'needs_human_review'
    CHECK (review_status IN ('needs_human_review','approved','rejected')),
  safety_decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (safety_decision IN ('pending','eligible','eligible_with_caution','excluded')),
  display_status TEXT NOT NULL DEFAULT 'hidden'
    CHECK (display_status IN ('hidden','published','disabled')),
  -- Minimal customer-facing recommender snapshot, copied and reviewed explicitly.
  -- These are not auto-filled from unapproved profile records during import.
  name_fa TEXT,
  name_en TEXT,
  scientific_name TEXT,
  oil_kind TEXT,
  texture TEXT,
  use_face TEXT,
  use_body TEXT,
  use_massage TEXT,
  use_hair_shaft TEXT,
  use_scalp TEXT,
  use_traditional TEXT,
  use_hair_types TEXT,
  evidence_levels TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  CONSTRAINT guide_recommendation_review_check CHECK (
    review_status <> 'approved' OR
    (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND safety_decision <> 'pending')
  ),
  CONSTRAINT guide_recommendation_name_check CHECK (
    review_status <> 'approved' OR safety_decision = 'excluded'
    OR (name_fa IS NOT NULL AND btrim(name_fa) <> '')
  ),
  CONSTRAINT guide_recommendation_publish_check CHECK (
    display_status <> 'published' OR
    (review_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND safety_decision IN ('eligible','eligible_with_caution')
      AND name_fa IS NOT NULL AND btrim(name_fa) <> '')
  )
);
CREATE INDEX guide_recommendation_reviews_status_idx
  ON oil_encyclopedia.guide_recommendation_reviews(review_status, safety_decision);

CREATE VIEW oil_encyclopedia.public_guide_oils AS
SELECT
  m.id AS mapping_id,
  a.id AS area_id, a.slug AS area_slug, a.name_fa AS area_name_fa, a.name_en AS area_name_en,
  c.id AS category_id, c.slug AS category_slug, c.name_fa AS category_name_fa, c.name_en AS category_name_en,
  n.id AS concern_id, n.slug AS concern_slug, n.name_fa AS concern_name_fa, n.name_en AS concern_name_en,
  m.oil_id, oil.name_fa AS oil_name_fa, oil.name_en AS oil_name_en,
  oil.scientific_name, oil.inci_name, oil.other_names, oil.oil_kind, oil.texture,
  approved_map.problem_id, problem.name_fa AS problem_name_fa,
  approved_map.evidence_level, approved_map.show_usage_method, m.sort_order
FROM oil_encyclopedia.oil_guide_mappings m
JOIN oil_encyclopedia.guide_categories c ON c.id = m.category_id AND c.is_active IS TRUE
JOIN oil_encyclopedia.guide_areas a ON a.id = c.area_id AND a.is_active IS TRUE
JOIN oil_encyclopedia.guide_concerns n
  ON n.id = m.concern_id AND n.category_id = c.id AND n.is_active IS TRUE
 AND n.review_status = 'approved' AND n.display_status = 'published'
 AND n.reviewed_by IS NOT NULL AND n.reviewed_at IS NOT NULL
JOIN oil_encyclopedia.problem_oil_map source_map
  ON source_map.map_id = m.supporting_record_id
 AND source_map.oil_id = m.oil_id
 AND source_map.app_id = n.source_app_id
JOIN oil_encyclopedia.public_problem_oils approved_map
  ON approved_map.map_id = source_map.map_id
 AND approved_map.oil_id = source_map.oil_id
JOIN oil_encyclopedia.problems problem ON problem.problem_id = approved_map.problem_id
JOIN oil_encyclopedia.public_oil_profiles oil ON oil.oil_id = m.oil_id
WHERE m.supporting_record_type = 'problem_oil_map'
  AND m.review_status = 'approved'
  AND m.display_status = 'published'
  AND m.reviewed_by IS NOT NULL
  AND m.reviewed_at IS NOT NULL;

CREATE VIEW oil_encyclopedia.public_guide_questionnaire_concerns AS
SELECT n.id, n.category_id, c.slug AS category_slug, a.slug AS area_slug,
       n.slug, n.name_en, n.name_fa, n.description, n.sort_order
FROM oil_encyclopedia.guide_concerns n
JOIN oil_encyclopedia.guide_categories c ON c.id = n.category_id AND c.is_active IS TRUE
JOIN oil_encyclopedia.guide_areas a ON a.id = c.area_id AND a.is_active IS TRUE
WHERE n.is_active IS TRUE
  AND n.review_status = 'approved'
  AND n.display_status = 'published'
  AND n.reviewed_by IS NOT NULL
  AND n.reviewed_at IS NOT NULL;

CREATE VIEW oil_encyclopedia.public_guide_areas AS
SELECT a.id, a.slug, a.name_en, a.name_fa, a.description, a.seo_title, a.seo_description, a.sort_order,
       COUNT(DISTINCT go.oil_id)::INTEGER AS available_oil_count
FROM oil_encyclopedia.guide_areas a
LEFT JOIN oil_encyclopedia.public_guide_oils go ON go.area_id = a.id
WHERE a.is_active IS TRUE
GROUP BY a.id, a.slug, a.name_en, a.name_fa, a.description, a.seo_title, a.seo_description, a.sort_order;

CREATE VIEW oil_encyclopedia.public_guide_categories AS
SELECT c.id, c.area_id, a.slug AS area_slug, c.parent_id, c.slug, c.name_en, c.name_fa,
       c.description, c.seo_title, c.seo_description, c.sort_order,
       COUNT(DISTINCT go.oil_id)::INTEGER AS available_oil_count
FROM oil_encyclopedia.guide_categories c
JOIN oil_encyclopedia.guide_areas a ON a.id = c.area_id AND a.is_active IS TRUE
LEFT JOIN oil_encyclopedia.public_guide_oils go ON go.category_id = c.id
WHERE c.is_active IS TRUE
GROUP BY c.id, c.area_id, a.slug, c.parent_id, c.slug, c.name_en, c.name_fa,
         c.description, c.seo_title, c.seo_description, c.sort_order;

CREATE VIEW oil_encyclopedia.public_guide_concerns AS
SELECT n.id, n.category_id, c.slug AS category_slug, a.slug AS area_slug,
       n.slug, n.name_en, n.name_fa, n.description, n.sort_order,
       COUNT(DISTINCT go.oil_id)::INTEGER AS available_oil_count
FROM oil_encyclopedia.guide_concerns n
JOIN oil_encyclopedia.guide_categories c ON c.id = n.category_id AND c.is_active IS TRUE
JOIN oil_encyclopedia.guide_areas a ON a.id = c.area_id AND a.is_active IS TRUE
JOIN oil_encyclopedia.public_guide_oils go ON go.concern_id = n.id
WHERE n.is_active IS TRUE
GROUP BY n.id, n.category_id, c.slug, a.slug, n.slug, n.name_en, n.name_fa,
         n.description, n.sort_order;

CREATE VIEW oil_encyclopedia.public_guide_recommendation_candidates AS
SELECT
  o.oil_id,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.name_fa END AS oil_name_fa,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.name_en END AS oil_name_en,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.scientific_name END AS scientific_name,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.oil_kind END AS oil_kind,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.texture END AS texture,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_face END AS use_face,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_body END AS use_body,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_massage END AS use_massage,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_hair_shaft END AS use_hair_shaft,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_scalp END AS use_scalp,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_traditional END AS use_traditional,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN r.use_hair_types END AS use_hair_types,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN COALESCE(mapped.concern_ids, ARRAY[]::text[]) ELSE ARRAY[]::text[] END AS concern_ids,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN COALESCE(mapped.category_ids, ARRAY[]::text[]) ELSE ARRAY[]::text[] END AS category_ids,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN COALESCE(mapped.area_slugs, ARRAY[]::text[]) ELSE ARRAY[]::text[] END AS area_slugs,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN COALESCE(r.evidence_levels, ARRAY[]::text[]) ELSE ARRAY[]::text[] END AS evidence_levels,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
         AND r.safety_decision IN ('eligible','eligible_with_caution')
       THEN COALESCE(safety.safety_warnings, ARRAY[]::text[]) ELSE ARRAY[]::text[] END AS safety_warnings,
  CASE WHEN r.review_status = 'approved' AND r.display_status = 'published'
       THEN r.safety_decision ELSE NULL END AS safety_decision,
  COALESCE((
    r.review_status = 'approved'
    AND r.display_status = 'published'
    AND r.safety_decision IN ('eligible','eligible_with_caution')
    AND r.name_fa IS NOT NULL
    AND btrim(r.name_fa) <> ''
    AND COALESCE(cardinality(mapped.concern_ids), 0) > 0
    AND (
      r.safety_decision <> 'eligible_with_caution'
      OR COALESCE(cardinality(safety.safety_warnings), 0) > 0
    )
  ), FALSE) AS recommendation_eligible
FROM oil_encyclopedia.oils o
LEFT JOIN oil_encyclopedia.guide_recommendation_reviews r ON r.oil_id = o.oil_id
LEFT JOIN LATERAL (
  SELECT
    array_agg(DISTINCT n.id) FILTER (WHERE n.id IS NOT NULL) AS concern_ids,
    array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) AS category_ids,
    array_agg(DISTINCT a.slug) FILTER (WHERE a.slug IS NOT NULL) AS area_slugs
  FROM oil_encyclopedia.oil_guide_mappings m
  JOIN oil_encyclopedia.problem_oil_map source_map
    ON source_map.map_id = m.supporting_record_id
   AND source_map.oil_id = m.oil_id
  JOIN oil_encyclopedia.public_problem_oils approved_map
    ON approved_map.map_id = source_map.map_id
   AND approved_map.oil_id = source_map.oil_id
  JOIN oil_encyclopedia.guide_concerns n
    ON n.id = m.concern_id
   AND n.source_app_id = source_map.app_id
   AND n.review_status = 'approved'
   AND n.display_status = 'published'
   AND n.reviewed_by IS NOT NULL
   AND n.reviewed_at IS NOT NULL
  JOIN oil_encyclopedia.guide_categories c ON c.id = n.category_id AND c.is_active IS TRUE
  JOIN oil_encyclopedia.guide_areas a ON a.id = c.area_id AND a.is_active IS TRUE
  WHERE m.oil_id = o.oil_id
    AND m.supporting_record_type = 'problem_oil_map'
    AND m.review_status = 'approved'
    AND m.display_status <> 'disabled'
    AND m.reviewed_by IS NOT NULL
    AND m.reviewed_at IS NOT NULL
) mapped ON TRUE
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT warning.customer_text)
           FILTER (WHERE COALESCE(btrim(warning.customer_text), '') <> '') AS safety_warnings
  FROM oil_encyclopedia.public_safety_warnings warning
  WHERE warning.oil_id = o.oil_id
) safety ON TRUE;

GRANT SELECT ON oil_encyclopedia.public_guide_areas,
  oil_encyclopedia.public_guide_categories,
  oil_encyclopedia.public_guide_concerns,
  oil_encyclopedia.public_guide_oils,
  oil_encyclopedia.public_guide_questionnaire_concerns,
  oil_encyclopedia.public_guide_recommendation_candidates
TO shahoo_oil_encyclopedia_reader;
`;

const GUIDE_VIEW_NAMES = [
  "public_guide_areas",
  "public_guide_categories",
  "public_guide_concerns",
  "public_guide_oils",
  "public_guide_questionnaire_concerns",
  "public_guide_recommendation_candidates",
];


function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Unexpected SQL identifier in source bundle.");
  return '"' + value + '"';
}

export function extractTableNames(ddl) {
  return [...new Set([...ddl.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)].map((match) => match[1].toLowerCase()))];
}

export function extractViewNames(ddl) {
  return [...new Set([...ddl.matchAll(/CREATE\s+VIEW\s+([a-z_][a-z0-9_]*)/gi)].map((match) => match[1].toLowerCase()))];
}

export function namespaceSchemaSql(source) {
  const tables = extractTableNames(source);
  if (tables.length === 0) throw new Error("No CREATE TABLE statements found in schema_v32.sql.");
  let ddl = source;

  for (const table of tables) {
    const escaped = table;
    const refs = [
      new RegExp("(\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?)" + escaped + "\\b", "gi"),
      new RegExp("(\\bALTER\\s+TABLE\\s+)" + escaped + "\\b", "gi"),
      new RegExp("(\\bREFERENCES\\s+)" + escaped + "\\b", "gi"),
      new RegExp("(\\bFROM\\s+)" + escaped + "\\b", "gi"),
      new RegExp("(\\bJOIN\\s+)" + escaped + "\\b", "gi"),
    ];
    for (const ref of refs) ddl = ddl.replace(ref, "$1" + SCHEMA + "." + table);
  }

  ddl = ddl.replace(
    /^(\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b[^\n]*?\bON\s+)([a-z_][a-z0-9_]*)/gim,
    (full, prefix, table) => tables.includes(table.toLowerCase()) ? prefix + SCHEMA + "." + table : full,
  );
  for (const view of extractViewNames(source)) {
    const escaped = view;
    const refs = [
      new RegExp("(\\bFROM\\s+)" + escaped + "\\b", "gi"),
      new RegExp("(\\bJOIN\\s+)" + escaped + "\\b", "gi"),
    ];    for (const ref of refs) ddl = ddl.replace(ref, "$1" + SCHEMA + "." + view);
  }
  ddl = ddl.replace(/(\bCREATE\s+VIEW\s+)([a-z_][a-z0-9_]*)/gi, "$1" + SCHEMA + ".$2");
  ddl = ddl.replace(/ON\s+SCHEMA\s+public\b/gi, "ON SCHEMA " + SCHEMA);
  ddl = ddl.replace(/IN SCHEMA\s+public\b/gi, "IN SCHEMA " + SCHEMA);
  ddl = ddl.replace(
    /(\bGRANT\s+SELECT\s+ON\s+)([\s\S]*?)(\s+TO\s+shahoo_web_reader\b)/i,
    (full, prefix, list, suffix) => prefix + list.split(",").map((name) => SCHEMA + "." + name.trim()).join(", ") + suffix,
  );
  ddl = ddl.replace(/shahoo_web_reader/g, "shahoo_oil_encyclopedia_reader");
  return "CREATE SCHEMA IF NOT EXISTS " + SCHEMA + ";\n" + ddl;
}

export function buildImportDdl(source) {
  const correctedHeader = source.replace(
    /^-- SHAHOO Oil Encyclopedia v3\.1\b/m,
    "-- SHAHOO Oil Encyclopedia v3.2",
  );
  return namespaceSchemaSql(correctedHeader) + "\n" + GUIDE_TAXONOMY_DDL;
}

export function normalizeTableRows(tableName, rows) {
  if (tableName !== "table_decisions") return rows;
  return rows.map((row) => {
    const normalized = { ...row };
    if (Object.hasOwn(normalized, "row_count")) {
      if (Object.hasOwn(normalized, "rows_v3") && normalized.rows_v3 !== normalized.row_count) {
        throw new Error("Conflicting row_count and rows_v3 values in Table_Decisions.json.");
      }
      normalized.rows_v3 ??= normalized.row_count;
      delete normalized.row_count;
    }
    if (Object.hasOwn(normalized, "location")) {
      if (Object.hasOwn(normalized, "location_v31") && normalized.location_v31 !== normalized.location) {
        throw new Error("Conflicting location and location_v31 values in Table_Decisions.json.");
      }
      normalized.location_v31 ??= normalized.location;
      delete normalized.location;
    }
    return normalized;
  });
}
export function sortTablesByDependencies(tableNames, foreignKeys) {
  const included = new Set(tableNames);
  const outgoing = new Map(tableNames.map((name) => [name, new Set()]));
  const indegree = new Map(tableNames.map((name) => [name, 0]));

  for (const { parentTable, childTable } of foreignKeys) {
    if (!included.has(parentTable) || !included.has(childTable) || parentTable === childTable) continue;
    const children = outgoing.get(parentTable);
    if (!children.has(childTable)) {
      children.add(childTable);
      indegree.set(childTable, indegree.get(childTable) + 1);
    }
  }

  const ready = tableNames.filter((name) => indegree.get(name) === 0);
  const ordered = [];
  while (ready.length) {
    const current = ready.shift();
    ordered.push(current);
    for (const child of outgoing.get(current)) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) ready.push(child);
    }
  }
  if (ordered.length !== tableNames.length) {
    throw new Error("Foreign-key dependency cycle detected in the active import tables; refusing an unsafe import order.");
  }
  return ordered;
}

async function getForeignKeyDependencies(client) {
  const result = await client.query(
    'SELECT parent.relname AS "parentTable", child.relname AS "childTable" ' +
      "FROM pg_constraint constraint_row " +
      "JOIN pg_class child ON child.oid = constraint_row.conrelid " +
      "JOIN pg_namespace child_schema ON child_schema.oid = child.relnamespace " +
      "JOIN pg_class parent ON parent.oid = constraint_row.confrelid " +
      "JOIN pg_namespace parent_schema ON parent_schema.oid = parent.relnamespace " +
      "WHERE constraint_row.contype = 'f' AND child_schema.nspname = $1 " +
      "AND parent_schema.nspname = $1",
    [SCHEMA],
  );
  return result.rows;
}

export function dataFileToTable(fileName) {
  return basename(fileName, ".json")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--confirm-non-production") args.set("confirm", true);
    else if (argv[index] === "--target-branch") {
      args.set("targetBranch", argv[index + 1] ?? "");
      index += 1;
    }
  }
  return args;
}

async function getTableMetadata(client, tableName) {
  const columns = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns " +
      "WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
    [SCHEMA, tableName],
  );
  const primary = await client.query(
    "SELECT kcu.column_name FROM information_schema.table_constraints tc " +
      "JOIN information_schema.key_column_usage kcu " +
      "ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name " +
      "WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2 " +
      "ORDER BY kcu.ordinal_position",
    [SCHEMA, tableName],
  );
  if (columns.rows.length === 0 || primary.rows.length === 0) {
    throw new Error("Missing table or primary key in " + SCHEMA + "." + tableName + ".");
  }
  return {
    columns: new Map(columns.rows.map((row) => [row.column_name, row])),
    primaryKey: primary.rows.map((row) => row.column_name),
  };
}

async function insertRows(client, tableName, rows, metadata) {
  if (rows.length === 0) return;
  const groups = new Map();
  for (const row of rows) {
    const keys = Object.keys(row).sort();
    const signature = keys.join("|");
    if (!groups.has(signature)) groups.set(signature, { keys, rows: [] });
    groups.get(signature).rows.push(row);
  }

  for (const group of groups.values()) {
    const keys = group.keys;
    const allowed = new Set(metadata.columns.keys());
    const unknown = keys.filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error("Unexpected columns in " + tableName + ".json: " + unknown.join(", "));

    const updates = keys.filter((key) => !metadata.primaryKey.includes(key));
    const conflict = updates.length
      ? "DO UPDATE SET " + updates.map((key) => quoteIdentifier(key) + " = EXCLUDED." + quoteIdentifier(key)).join(", ")
      : "DO NOTHING";
    const batchSize = 100;

    for (let offset = 0; offset < group.rows.length; offset += batchSize) {
      const batch = group.rows.slice(offset, offset + batchSize);
      const values = [];
      let parameter = 0;
      const tuples = batch.map((row) => {
        const placeholders = keys.map((key) => {
          parameter += 1;
          const column = metadata.columns.get(key);
          let value = row[key];
          let cast = "";
          if (column?.data_type === "jsonb" && value !== null && value !== undefined) {
            value = JSON.stringify(value);
            cast = "::jsonb";
          }
          values.push(value ?? null);
          return "$" + parameter + cast;
        });
        return "(" + placeholders.join(", ") + ")";
      });
      const statement =
        "INSERT INTO " + SCHEMA + "." + quoteIdentifier(tableName) +
        " (" + keys.map(quoteIdentifier).join(", ") + ") VALUES " + tuples.join(", ") +
        " ON CONFLICT (" + metadata.primaryKey.map(quoteIdentifier).join(", ") + ") " + conflict;
      await client.query(statement, values);
    }
  }
}

async function populateRecordSources(client, imported) {
  const links = [];
  for (const item of imported) {
    for (const row of item.rows) {
      if (!Array.isArray(row.source_ids)) continue;
      const recordId = row[item.primaryKey];
      if (recordId === null || recordId === undefined) continue;
      for (const sourceId of new Set(row.source_ids.filter((value) => typeof value === "string" && value))) {
        links.push([item.tableName, String(recordId), sourceId, "support"]);
      }
    }
  }

  for (let offset = 0; offset < links.length; offset += 500) {
    const batch = links.slice(offset, offset + 500);
    const values = [];
    let parameter = 0;
    const tuples = batch.map((row) => "(" + row.map((value) => {
      parameter += 1;
      values.push(value);
      return "$" + parameter;
    }).join(", ") + ")");
    await client.query(
      "INSERT INTO " + SCHEMA + ".record_sources (table_name, record_id, source_id, role) " +
        "VALUES " + tuples.join(", ") +
        " ON CONFLICT (table_name, record_id, source_id) DO NOTHING",
      values,
    );
  }
  return links.length;
}



async function seedGuideTaxonomy(client) {
  const areas = [
    ["hair", "hair", "Hair", "مو", "مرور موضوعات ثبت‌شده در دانشنامه درباره ساقه مو و ناحیه ریشه و پوست سر.", 10],
    ["skin", "skin", "Skin", "پوست", "مرور موضوعات ثبت‌شده در دانشنامه درباره کاربردهای پوستی.", 20],
    ["topical", "topical-use", "Topical use", "کاربرد موضعی", "مرور موضوعات ثبت‌شده در دانشنامه درباره کاربرد موضعی و ماساژ.", 30],
  ];
  for (const row of areas) {
    await client.query(
      "INSERT INTO oil_encyclopedia.guide_areas (id, slug, name_en, name_fa, description, sort_order) VALUES ($1,$2,$3,$4,$5,$6)",
      row,
    );
  }

  const categories = [
    ["cat-hair-shaft", "hair", "ساقه مو", "hair-shaft", "Hair shaft", "ساقه مو", 10],
    ["cat-hair-roots-scalp", "hair", "ریشه مو و پوست سر", "hair-roots-scalp", "Hair roots & scalp", "ریشه مو و پوست سر", 20],
    ["cat-skin", "skin", "پوست", "skin-care", "Skin care", "پوست", 10],
    ["cat-traditional-topical", "topical", "سنتی و موضعی", "traditional-topical", "Traditional & topical", "سنتی و موضعی", 10],
    ["cat-massage", "topical", "ماساژ", "massage", "Massage", "ماساژ", 20],
  ];
  for (const row of categories) {
    await client.query(
      "INSERT INTO oil_encyclopedia.guide_categories (id, area_id, source_category, slug, name_en, name_fa, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      row,
    );
  }

  const categoryBySource = new Map([
    ["ساقه مو", "cat-hair-shaft"],
    ["ریشه مو و پوست سر", "cat-hair-roots-scalp"],
    ["پوست", "cat-skin"],
    ["سنتی و موضعی", "cat-traditional-topical"],
    ["ماساژ", "cat-massage"],
  ]);
  const englishConcernLabels = new Map([
    ["HS-01", "Dryness and roughness of the hair shaft"],
    ["HS-02", "Hair frizz"],
    ["HS-03", "Wash-related damage and protein loss (pre-wash context)"],
    ["HS-04", "Brittleness and split ends"],
    ["HS-05", "Shine, softness and manageability"],
    ["HS-06", "Pre-coloring and heat-styling context"],
    ["SC-01", "Androgenetic alopecia (pattern hair loss)"],
    ["SC-02", "Alopecia areata"],
    ["SC-03", "Dandruff"],
    ["SC-04", "Dry and itchy scalp"],
    ["SC-05", "Oily scalp"],
    ["SC-06", "Head lice"],
    ["SC-07", "Diffuse hair shedding (telogen / scattered shedding)"],
    ["SC-08", "Scalp sensitivity, burning and irritation"],
    ["SK-01", "Dry skin"],
    ["SK-02", "Skin-barrier support / atopic dermatitis context"],
    ["SK-03", "Acne-prone skin"],
    ["SK-04", "Stretch marks"],
    ["SK-05", "Scars and scar appearance"],
    ["SK-06", "Skin elasticity, wrinkles and skin aging"],
    ["SK-07", "Infant skin care"],
    ["SK-08", "Makeup removal and cleansing oil"],
    ["SK-09", "Lip, hand, cuticle and nail care"],
    ["SK-10", "Superficial wounds and burns (therapeutic-claim topic)"],
    ["SK-11", "Superficial skin/nail fungal conditions (therapeutic-claim topic)"],
    ["SK-12", "Oily and combination skin"],
    ["SK-13", "Uneven skin tone and dark spots"],
    ["TR-01", "Traditional Iranian and other traditional uses"],
    ["TR-02", "Localized muscle and joint discomfort"],
    ["TR-03", "Topical headache-related use"],
    ["TR-04", "Nasal congestion and breathing (inhalation)"],
    ["TR-05", "Localized itching, bites and irritation"],
    ["TR-06", "Sleep and relaxation (inhalation / topical)"],
    ["MS-01", "Body massage base oil"],
    ["MS-02", "Relaxation massage and aromatherapy"],
    ["MS-03", "Infant massage"],
    ["MS-04", "Sports and muscle massage"],
    ["MS-05", "Scalp massage"],
  ]);
  const applications = await client.query(
    "SELECT app_id, category, name_fa FROM oil_encyclopedia.applications ORDER BY app_id",
  );
  let concerns = 0;
  for (const application of applications.rows) {
    const categoryId = categoryBySource.get(application.category);
    if (!categoryId || !application.app_id || !application.name_fa) continue;
    await client.query(
      "INSERT INTO oil_encyclopedia.guide_concerns (id, category_id, source_app_id, slug, name_en, name_fa, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      ["concern-" + application.app_id.toLowerCase(), categoryId, application.app_id, application.app_id.toLowerCase(), englishConcernLabels.get(application.app_id) ?? null, application.name_fa, concerns * 10],
    );
    concerns += 1;
  }

  const mappings = await client.query(
    "INSERT INTO oil_encyclopedia.oil_guide_mappings " +
      "(id, oil_id, category_id, concern_id, supporting_record_type, supporting_record_id, relevance_type, evidence_status, review_status, display_status, sort_order) " +
      "SELECT 'guide-' || pm.map_id, pm.oil_id, c.id, n.id, 'problem_oil_map', pm.map_id, " +
      "'problem_oil_mapping', COALESCE(NULLIF(pm.evidence_level, ''), NULLIF(pm.claim_status, ''), 'unknown'), " +
      "'needs_human_review', 'hidden', COALESCE(pm.rank, 0) " +
      "FROM oil_encyclopedia.problem_oil_map pm " +
      "JOIN oil_encyclopedia.guide_concerns n ON n.source_app_id = pm.app_id " +
      "JOIN oil_encyclopedia.guide_categories c ON c.id = n.category_id " +
      "ON CONFLICT (id) DO NOTHING",
  );
  const recommendationReviews = await client.query(
    "INSERT INTO oil_encyclopedia.guide_recommendation_reviews (oil_id) " +
      "SELECT oil_id FROM oil_encyclopedia.oils ON CONFLICT (oil_id) DO NOTHING",
  );
  console.log("[oil-import] guide taxonomy: 3 areas, " + categories.length + " categories, " + concerns + " concerns, " + mappings.rowCount + " hidden mappings, " + recommendationReviews.rowCount + " pending recommendation reviews");
  return { areas: areas.length, categories: categories.length, concerns, hiddenMappings: mappings.rowCount, pendingRecommendationReviews: recommendationReviews.rowCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetBranch = args.get("targetBranch");
  if (!args.get("confirm") || !targetBranch || /production|main/i.test(targetBranch)) {
    throw new Error("Refusing import. Supply --confirm-non-production and --target-branch <non-production-branch>.");
  }
  const sourceDir = process.env.OIL_ENCYCLOPEDIA_SOURCE_DIR?.trim();
  const connectionString = process.env.OIL_ENCYCLOPEDIA_IMPORT_URL?.trim();
  const configuredTarget = process.env.OIL_ENCYCLOPEDIA_TARGET_BRANCH?.trim();
  const expectedHost = process.env.OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_HOST?.trim().toLowerCase();
  const expectedDatabase = process.env.OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_DATABASE?.trim();
  if (!sourceDir || !connectionString || !expectedHost || !expectedDatabase) {
    throw new Error("Set OIL_ENCYCLOPEDIA_SOURCE_DIR, OIL_ENCYCLOPEDIA_IMPORT_URL, OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_HOST and OIL_ENCYCLOPEDIA_IMPORT_EXPECTED_DATABASE. DATABASE_URL is never used.");
  }

  if (!configuredTarget || configuredTarget !== targetBranch) {
    throw new Error("OIL_ENCYCLOPEDIA_TARGET_BRANCH must exactly match --target-branch.");
  }
  if (connectionString === process.env.DATABASE_URL?.trim()) {
    throw new Error("The encyclopedia importer must not use the storefront DATABASE_URL.");
  }
  let importUrl;
  try {
    importUrl = new URL(connectionString);
  } catch {
    throw new Error("OIL_ENCYCLOPEDIA_IMPORT_URL must be a valid PostgreSQL URL.");
  }
  const actualDatabase = decodeURIComponent(importUrl.pathname.replace(/^\//, ""));
  if (importUrl.hostname.toLowerCase() !== expectedHost || actualDatabase !== expectedDatabase) {
    throw new Error("Import URL host/database do not match the explicitly allowlisted non-production target.");
  }
  if (!/^(staging|test|dev|.*integration.*)$/i.test(targetBranch)) {
    throw new Error("Import target must be a clearly named Staging, test, dev or integration branch.");
  }

  const root = resolve(sourceDir);
  const validatorPath = join(root, "validation", "validate_v32.py");
  const validatorCommands = process.platform === "win32" ? [["py", ["-3", validatorPath]], ["python", [validatorPath]]] : [["python3", [validatorPath]], ["python", [validatorPath]]];
  let validatorResult = null;
  for (const [command, commandArgs] of validatorCommands) {
    const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", windowsHide: true });
    if (!result.error) {
      validatorResult = result;
      break;
    }
  }
  if (!validatorResult) throw new Error("Python 3 is required to run validation/validate_v32.py before import.");
  if (validatorResult.status !== 0) {
    throw new Error("The v3.2 dataset validator failed. Review its output before importing. " + (validatorResult.stderr || ""));
  }
  const validationReport = JSON.parse(await readFile(join(root, "data", "validation_report.json"), "utf8"));
  if (validationReport.version !== "3.2" || validationReport.errors !== 0 ||
      validationReport.warnings !== 0 || validationReport.active_tables !== EXPECTED_DATA_TABLES ||
      validationReport.fail_closed_tests !== validationReport.fail_closed_tests_passed) {
    throw new Error("The generated v3.2 validation report does not meet the import gate.");
  }

  const ddl = await readFile(join(root, "sql", "schema_v32.sql"), "utf8");
  const dataDir = join(root, "data");
  const files = (await readdir(dataDir))
    .filter((file) => file.endsWith(".json") && !SKIP_FILES.has(file))
    .sort();
  if (files.length !== EXPECTED_DATA_TABLES) {
    throw new Error("Expected " + EXPECTED_DATA_TABLES + " active JSON tables; found " + files.length + ".");
  }
  if (extractTableNames(ddl).length !== EXPECTED_DDL_TABLES || extractViewNames(ddl).length !== EXPECTED_PUBLIC_VIEWS) {
    throw new Error("Unexpected v3.2 DDL structure; stop and review the source bundle.");
  }

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const target = await client.query("SELECT current_database() AS database_name, current_user AS role_name");
    console.log("[oil-import] target branch: " + targetBranch + "; database: " + target.rows[0].database_name + "; role: " + target.rows[0].role_name);
    const existing = await client.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists",
      [SCHEMA],
    );
    if (existing.rows[0].exists) {
      throw new Error("Schema " + SCHEMA + " already exists. Refusing to overwrite or merge an existing import.");
    }

    await client.query("BEGIN");
    try {
      await client.query(buildImportDdl(ddl));
      const fileByTable = new Map(files.map((file) => [dataFileToTable(file), file]));
      if (fileByTable.size !== files.length) {
        throw new Error("Duplicate active JSON files resolve to the same SQL table name.");
      }
      const tableNames = [...fileByTable.keys()];
      const dependencies = await getForeignKeyDependencies(client);
      const importOrder = sortTablesByDependencies(tableNames, dependencies);
      const imported = [];
      for (const tableName of importOrder) {
        const file = fileByTable.get(tableName);
        const rawRows = JSON.parse(await readFile(join(dataDir, file), "utf8"));
        if (!Array.isArray(rawRows)) throw new Error("Expected an array in " + file + ".");
        const rows = normalizeTableRows(tableName, rawRows);
        const metadata = await getTableMetadata(client, tableName);
        await insertRows(client, tableName, rows, metadata);
        imported.push({ tableName, rows, primaryKey: metadata.primaryKey[0] });
        console.log("[oil-import] " + tableName + ": " + rows.length);
      }
      const recordSourceLinks = await populateRecordSources(client, imported);
      const guideTaxonomy = await seedGuideTaxonomy(client);
      const viewNames = [...extractViewNames(ddl), ...GUIDE_VIEW_NAMES];
      const viewCounts = {};
      for (const view of viewNames) {
        const result = await client.query("SELECT count(*)::int AS count FROM " + SCHEMA + "." + quoteIdentifier(view));
        viewCounts[view] = result.rows[0].count;
      }
      await client.query("COMMIT");
      console.log(JSON.stringify({
        schema: SCHEMA,
        dataTables: imported.length,
        recordSourceLinks,
        guideTaxonomy,
        publicViewCounts: viewCounts,
        note: "Customer-facing views remain fail-closed; only signed-off records are returned.",
      }, null, 2));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("[oil-import] " + (error?.message ?? "Import failed"));
    process.exitCode = 1;
  });
}
