import type { OilRecommendationKnowledge } from "@/lib/store-types";

type OilProfileRow = {
  oil_id: string;
  name_fa: string | null;
  oil_kind: string | null;
  texture: string | null;
  use_face: string | null;
  use_body: string | null;
  use_massage: string | null;
  use_hair_shaft: string | null;
  use_scalp: string | null;
  safety_customer_status: string | null;
};

type SafetyWarningRow = {
  oil_id: string;
  customer_text: string;
};

const globalRef = globalThis as typeof globalThis & {
  __shahooOilEncyclopediaPool__?: Promise<import("pg").Pool>;
};

/** The bank is opt-in and never borrows the storefront DATABASE_URL. */
export function isOilEncyclopediaEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OIL_ENCYCLOPEDIA_ENABLED === "true";
}

async function getPool(): Promise<import("pg").Pool> {
  const connectionString = process.env.OIL_ENCYCLOPEDIA_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Oil encyclopedia is enabled but OIL_ENCYCLOPEDIA_DATABASE_URL is missing.");
  }

  globalRef.__shahooOilEncyclopediaPool__ ??= (async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", () => {
      // Do not log connection details or database error payloads.
      console.error("[oil-encyclopedia] idle read connection error");
    });
    return pool;
  })().catch((error) => {
    globalRef.__shahooOilEncyclopediaPool__ = undefined;
    throw error;
  });

  return globalRef.__shahooOilEncyclopediaPool__;
}

/**
 * Read only from the encyclopedia's explicitly approved public views.
 * The dedicated database role should have SELECT on these views only; the
 * transaction is additionally forced read-only as defense in depth.
 */
export async function getApprovedOilKnowledge(
  oilIds: string[],
): Promise<Map<string, OilRecommendationKnowledge>> {
  const uniqueIds = [...new Set(oilIds.filter(Boolean))];
  if (!isOilEncyclopediaEnabled() || uniqueIds.length === 0) return new Map();

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const profiles = await client.query(
      `SELECT oil_id, name_fa, oil_kind, texture, use_face, use_body,
              use_massage, use_hair_shaft, use_scalp, safety_customer_status
       FROM oil_encyclopedia.public_oil_profiles
       WHERE oil_id = ANY($1::text[])`,
      [uniqueIds],
    );
    const warnings = await client.query(
      `SELECT oil_id, customer_text
       FROM oil_encyclopedia.public_safety_warnings
       WHERE oil_id = ANY($1::text[])`,
      [uniqueIds],
    );
    await client.query("COMMIT");

    const warningsByOil = new Map<string, string[]>();
    for (const row of warnings.rows as SafetyWarningRow[]) {
      const text = row.customer_text?.trim();
      if (!text) continue;
      const current = warningsByOil.get(row.oil_id) ?? [];
      current.push(text);
      warningsByOil.set(row.oil_id, current);
    }

    return new Map(
      (profiles.rows as OilProfileRow[]).map((row) => [
        row.oil_id,
        {
          nameFa: row.name_fa,
          oilKind: row.oil_kind,
          texture: row.texture,
          useFace: row.use_face,
          useBody: row.use_body,
          useMassage: row.use_massage,
          useHairShaft: row.use_hair_shaft,
          useScalp: row.use_scalp,
          safetyCustomerStatus: row.safety_customer_status,
          safetyWarning: warningsByOil.get(row.oil_id)?.join("\n") ?? null,
        },
      ]),
    );
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original read failure.
    }
    // Fail closed: if the configured knowledge source is unavailable, do not
    // silently fall back to an unverified recommendation result.
    throw new Error("The configured oil knowledge source is unavailable.");
  } finally {
    client.release();
  }
}
