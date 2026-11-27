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
      new RegExp("(\\\\bFROM\\\\s+)" + escaped + "\\\\b", "gi"),
      new RegExp("(\\\\bJOIN\\\\s+)" + escaped + "\\\\b", "gi"),
    ];
    for (const ref of refs) ddl = ddl.replace(ref, "$1" + SCHEMA + "." + view);
  }
  ddl = ddl.replace(/(\bCREATE\s+VIEW\s+)([a-z_][a-z0-9_]*)/gi, "$1" + SCHEMA + ".$2");
  ddl = ddl.replace(/ON\s+SCHEMA\s+public\b/gi, "ON SCHEMA " + SCHEMA);
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
  return namespaceSchemaSql(correctedHeader) +
    "\nALTER TABLE oil_encyclopedia.table_decisions ADD COLUMN IF NOT EXISTS location TEXT;" +
    "\nALTER TABLE oil_encyclopedia.table_decisions ADD COLUMN IF NOT EXISTS row_count INTEGER;\n";
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetBranch = args.get("targetBranch");
  if (!args.get("confirm") || !targetBranch || /production|main/i.test(targetBranch)) {
    throw new Error("Refusing import. Supply --confirm-non-production and --target-branch <non-production-branch>.");
  }
  const sourceDir = process.env.OIL_ENCYCLOPEDIA_SOURCE_DIR?.trim();
  const connectionString = process.env.OIL_ENCYCLOPEDIA_IMPORT_URL?.trim();
  const configuredTarget = process.env.OIL_ENCYCLOPEDIA_TARGET_BRANCH?.trim();
  if (!sourceDir || !connectionString) {
    throw new Error("Set OIL_ENCYCLOPEDIA_SOURCE_DIR and OIL_ENCYCLOPEDIA_IMPORT_URL. DATABASE_URL is never used.");
  }

  if (!configuredTarget || configuredTarget !== targetBranch) {
    throw new Error("OIL_ENCYCLOPEDIA_TARGET_BRANCH must exactly match --target-branch.");
  }
  if (connectionString === process.env.DATABASE_URL?.trim()) {
    throw new Error("The encyclopedia importer must not use the storefront DATABASE_URL.");
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
      const imported = [];
      for (const file of files) {
        const tableName = dataFileToTable(file);
        const rows = JSON.parse(await readFile(join(dataDir, file), "utf8"));
        if (!Array.isArray(rows)) throw new Error("Expected an array in " + file + ".");
        const metadata = await getTableMetadata(client, tableName);
        await insertRows(client, tableName, rows, metadata);
        imported.push({ tableName, rows, primaryKey: metadata.primaryKey[0] });
        console.log("[oil-import] " + tableName + ": " + rows.length);
      }
      const recordSourceLinks = await populateRecordSources(client, imported);
      const viewNames = extractViewNames(ddl);
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
