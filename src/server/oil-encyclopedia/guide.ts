import {
  getOilEncyclopediaPool,
  isOilEncyclopediaEnabled,
} from "./client.ts";

export type GuideSourceStatus = "ready" | "disabled" | "unavailable";

export type GuideArea = {
  id: string;
  slug: string;
  nameEn: string;
  nameFa: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  availableOilCount: number;
};

export type GuideCategory = {
  id: string;
  areaId: string;
  areaSlug: string;
  parentId: string | null;
  slug: string;
  nameEn: string | null;
  nameFa: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  availableOilCount: number;
};

export type GuideConcern = {
  id: string;
  categoryId: string;
  categorySlug: string;
  areaSlug: string;
  slug: string;
  nameEn: string | null;
  nameFa: string;
  description: string;
  sortOrder: number;
  availableOilCount: number;
};

export type GuideOilCard = {
  oilId: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  scientificName: string | null;
  inciName: string | null;
  otherNames: string[] | null;
  oilKind: string | null;
  texture: string | null;
  areaSlug: string;
  areaNameFa: string;
  areaNameEn: string;
  categorySlug: string;
  categoryNameFa: string;
  categoryNameEn: string;
  concernSlug: string;
  concernNameFa: string;
  concernNameEn: string;
  problemNameFa: string | null;
  sortOrder: number;
};

type GuideResult<T> = {
  status: GuideSourceStatus;
  data: T;
};

type DbRow = Record<string, string | number | boolean | null | string[] | Date>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapArea(row: DbRow): GuideArea {
  return {
    id: text(row.id),
    slug: text(row.slug),
    nameEn: text(row.name_en),
    nameFa: text(row.name_fa),
    description: text(row.description),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    sortOrder: number(row.sort_order),
    availableOilCount: number(row.available_oil_count),
  };
}

function mapCategory(row: DbRow): GuideCategory {
  return {
    id: text(row.id),
    areaId: text(row.area_id),
    areaSlug: text(row.area_slug),
    parentId: nullableText(row.parent_id),
    slug: text(row.slug),
    nameEn: nullableText(row.name_en),
    nameFa: text(row.name_fa),
    description: text(row.description),
    seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description),
    sortOrder: number(row.sort_order),
    availableOilCount: number(row.available_oil_count),
  };
}

function mapConcern(row: DbRow): GuideConcern {
  return {
    id: text(row.id),
    categoryId: text(row.category_id),
    categorySlug: text(row.category_slug),
    areaSlug: text(row.area_slug),
    slug: text(row.slug),
    nameEn: nullableText(row.name_en),
    nameFa: text(row.name_fa),
    description: text(row.description),
    sortOrder: number(row.sort_order),
    availableOilCount: number(row.available_oil_count),
  };
}

function mapOil(row: DbRow): GuideOilCard {
  const oilId = text(row.oil_id);
  return {
    oilId,
    slug: oilId.toLowerCase(),
    nameFa: text(row.oil_name_fa),
    nameEn: text(row.oil_name_en),
    scientificName: nullableText(row.scientific_name),
    inciName: nullableText(row.inci_name),
    otherNames: Array.isArray(row.other_names) ? row.other_names.filter((v): v is string => typeof v === "string") : null,
    oilKind: nullableText(row.oil_kind),
    texture: nullableText(row.texture),
    areaSlug: text(row.area_slug),
    areaNameFa: text(row.area_name_fa),
    areaNameEn: text(row.area_name_en),
    categorySlug: text(row.category_slug),
    categoryNameFa: text(row.category_name_fa),
    categoryNameEn: text(row.category_name_en),
    concernSlug: text(row.concern_slug),
    concernNameFa: text(row.concern_name_fa),
    concernNameEn: text(row.concern_name_en),
    problemNameFa: nullableText(row.problem_name_fa),
    sortOrder: number(row.sort_order),
  };
}

function dedupeOils(rows: DbRow[]): GuideOilCard[] {
  const byId = new Map<string, GuideOilCard>();
  const mergeLabel = (current: string, next: string) =>
    [...new Set([current, next].map((value) => value.trim()).filter(Boolean))].join(" · ");
  for (const row of rows) {
    const oil = mapOil(row);
    const current = byId.get(oil.oilId);
    if (!current) {
      byId.set(oil.oilId, oil);
      continue;
    }
    current.categoryNameFa = mergeLabel(current.categoryNameFa, oil.categoryNameFa);
    current.concernNameFa = mergeLabel(current.concernNameFa, oil.concernNameFa);
    current.problemNameFa = mergeLabel(current.problemNameFa ?? "", oil.problemNameFa ?? "") || null;
  }
  return [...byId.values()];
}

async function readGuide<T>(
  fallback: T,
  query: (client: import("pg").PoolClient) => Promise<T>,
): Promise<GuideResult<T>> {
  if (!isOilEncyclopediaEnabled()) return { status: "disabled", data: fallback };

  let client: import("pg").PoolClient | undefined;
  try {
    const pool = await getOilEncyclopediaPool();
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const data = await query(client);
    await client.query("COMMIT");
    return { status: "ready", data };
  } catch {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve fail-closed behavior without exposing database details.
      }
    }
    return { status: "unavailable", data: fallback };
  } finally {
    client?.release();
  }
}

const areaColumns = "id, slug, name_en, name_fa, description, seo_title, seo_description, sort_order, available_oil_count";
const categoryColumns = "id, area_id, area_slug, parent_id, slug, name_en, name_fa, description, seo_title, seo_description, sort_order, available_oil_count";
const concernColumns = "id, category_id, category_slug, area_slug, slug, name_en, name_fa, description, sort_order, available_oil_count";
const oilColumns = "oil_id, oil_name_fa, oil_name_en, scientific_name, inci_name, other_names, oil_kind, texture, area_slug, area_name_fa, area_name_en, category_slug, category_name_fa, category_name_en, concern_slug, concern_name_fa, concern_name_en, problem_name_fa, sort_order";

export async function readOilGuideLanding() {
  return readGuide<GuideArea[]>([], async (client) => {
    const result = await client.query(
      "SELECT " + areaColumns + " FROM oil_encyclopedia.public_guide_areas ORDER BY sort_order, name_fa",
    );
    return result.rows.map(mapArea);
  });
}

export async function readOilGuideArea(areaSlug: string) {
  return readGuide<{ area: GuideArea | null; categories: GuideCategory[]; oils: GuideOilCard[] }>({ area: null, categories: [], oils: [] }, async (client) => {
    const areaResult = await client.query(
      "SELECT " + areaColumns + " FROM oil_encyclopedia.public_guide_areas WHERE slug = $1 LIMIT 1",
      [areaSlug],
    );
    if (!areaResult.rows[0]) return { area: null, categories: [], oils: [] };
    const [categoriesResult, oilsResult] = await Promise.all([
      client.query(
        "SELECT " + categoryColumns + " FROM oil_encyclopedia.public_guide_categories WHERE area_slug = $1 ORDER BY sort_order, name_fa",
        [areaSlug],
      ),
      client.query(
        "SELECT " + oilColumns + " FROM oil_encyclopedia.public_guide_oils WHERE area_slug = $1 ORDER BY sort_order, oil_name_fa",
        [areaSlug],
      ),
    ]);
    const oils = dedupeOils(oilsResult.rows);
    return {
      area: mapArea(areaResult.rows[0]),
      categories: categoriesResult.rows.map(mapCategory),
      oils,
    };
  });
}

export async function readOilGuideCategory(areaSlug: string, categorySlug: string) {
  return readGuide<{
    category: GuideCategory | null;
    children: GuideCategory[];
    concerns: GuideConcern[];
    oils: GuideOilCard[];
  }>({ category: null, children: [], concerns: [], oils: [] }, async (client) => {
    const categoryResult = await client.query(
      "SELECT " + categoryColumns + " FROM oil_encyclopedia.public_guide_categories WHERE area_slug = $1 AND slug = $2 LIMIT 1",
      [areaSlug, categorySlug],
    );
    if (!categoryResult.rows[0]) return { category: null, children: [], concerns: [], oils: [] };
    const [childrenResult, concernsResult, oilsResult] = await Promise.all([
      client.query(
        "SELECT " + categoryColumns + " FROM oil_encyclopedia.public_guide_categories WHERE area_slug = $1 AND parent_id = $2 ORDER BY sort_order, name_fa",
        [areaSlug, categoryResult.rows[0].id],
      ),
      client.query(
        "SELECT " + concernColumns + " FROM oil_encyclopedia.public_guide_concerns WHERE area_slug = $1 AND category_slug = $2 ORDER BY sort_order, name_fa",
        [areaSlug, categorySlug],
      ),
      client.query(
        "SELECT " + oilColumns + " FROM oil_encyclopedia.public_guide_oils WHERE area_slug = $1 AND category_slug = $2 ORDER BY sort_order, oil_name_fa",
        [areaSlug, categorySlug],
      ),
    ]);
    const oils = dedupeOils(oilsResult.rows);
    return {
      category: mapCategory(categoryResult.rows[0]),
      children: childrenResult.rows.map(mapCategory),
      concerns: concernsResult.rows.map(mapConcern),
      oils,
    };
  });
}

export async function readOilGuideConcern(areaSlug: string, categorySlug: string, concernSlug: string) {
  return readGuide<{ concern: GuideConcern | null; oils: GuideOilCard[] }>({ concern: null, oils: [] }, async (client) => {
    const concernResult = await client.query(
      "SELECT " + concernColumns + " FROM oil_encyclopedia.public_guide_concerns WHERE area_slug = $1 AND category_slug = $2 AND slug = $3 LIMIT 1",
      [areaSlug, categorySlug, concernSlug],
    );
    if (!concernResult.rows[0]) return { concern: null, oils: [] };
    const oilsResult = await client.query(
      "SELECT " + oilColumns + " FROM oil_encyclopedia.public_guide_oils WHERE area_slug = $1 AND category_slug = $2 AND concern_slug = $3 ORDER BY sort_order, oil_name_fa",
      [areaSlug, categorySlug, concernSlug],
    );
    const oils = dedupeOils(oilsResult.rows);
    return { concern: mapConcern(concernResult.rows[0]), oils };
  });
}

export async function searchOilGuideRecords(query: string) {
  const normalized = query.trim().slice(0, 80);
  if (!normalized) return readGuide<GuideOilCard[]>([], async () => []);
  return readGuide<GuideOilCard[]>([], async (client) => {
    const result = await client.query(
      "SELECT " + oilColumns +
      " FROM oil_encyclopedia.public_guide_oils " +
      "WHERE oil_name_fa ILIKE $1 OR oil_name_en ILIKE $1 OR COALESCE(scientific_name, '') ILIKE $1 " +
      "OR COALESCE(inci_name, '') ILIKE $1 OR COALESCE(other_names::text, '') ILIKE $1 " +
      "OR area_name_fa ILIKE $1 OR area_name_en ILIKE $1 OR category_name_fa ILIKE $1 OR category_name_en ILIKE $1 OR concern_name_fa ILIKE $1 OR concern_name_en ILIKE $1 " +
      "ORDER BY oil_name_fa, sort_order LIMIT 80",
      ["%" + normalized + "%"],
    );
    return dedupeOils(result.rows);
  });
}

export async function readOilGuideProfile(oilSlug: string) {
  const match = /^oil-\d{3}$/i.exec(oilSlug);
  if (!match) return readGuide<{ profile: DbRow | null; claims: DbRow[]; protocols: DbRow[]; faqs: DbRow[]; qa: DbRow[]; warnings: DbRow[] }>({ profile: null, claims: [], protocols: [], faqs: [], qa: [], warnings: [] }, async () => ({ profile: null, claims: [], protocols: [], faqs: [], qa: [], warnings: [] }));
  const oilId = oilSlug.toUpperCase();
  return readGuide<{ profile: DbRow | null; claims: DbRow[]; protocols: DbRow[]; faqs: DbRow[]; qa: DbRow[]; warnings: DbRow[] }>({ profile: null, claims: [], protocols: [], faqs: [], qa: [], warnings: [] }, async (client) => {
    const [mapped, profileResult] = await Promise.all([
      client.query("SELECT oil_id FROM oil_encyclopedia.public_guide_oils WHERE oil_id = $1 LIMIT 1", [oilId]),
      client.query(
        "SELECT oil_id, name_fa, name_en, scientific_name, inci_name, other_names, family, plant_part, oil_kind, general_extraction, appearance, color, odor, texture, key_components, key_fatty_acids, known_actives, oxidation_stability, general_storage, sensitization_notes, use_hair_shaft, use_scalp, use_hair_types, use_face, use_body, use_massage, use_traditional, safety_customer_status FROM oil_encyclopedia.public_oil_profiles WHERE oil_id = $1 LIMIT 1",
        [oilId],
      ),
    ]);
    if (!mapped.rows.length || !profileResult.rows[0]) {
      return { profile: null, claims: [], protocols: [], faqs: [], qa: [], warnings: [] };
    }
    const [claims, protocols, faqs, qa, warnings] = await Promise.all([
      client.query("SELECT claim_id, app_id, customer_text FROM oil_encyclopedia.public_claims WHERE oil_id = $1 ORDER BY claim_id", [oilId]),
      client.query("SELECT protocol_id, app_id, purpose, area, customer_text FROM oil_encyclopedia.public_protocols WHERE oil_id = $1 ORDER BY protocol_id", [oilId]),
      client.query("SELECT faq_id, category, question, answer FROM oil_encyclopedia.public_faq WHERE oil_id = $1 ORDER BY faq_id", [oilId]),
      client.query("SELECT qa_id, question_key, answer FROM oil_encyclopedia.public_oil_qa WHERE oil_id = $1 ORDER BY qa_id", [oilId]),
      client.query("SELECT customer_text, customer_display_scope FROM oil_encyclopedia.public_safety_warnings WHERE oil_id = $1", [oilId]),
    ]);
    return {
      profile: profileResult.rows[0],
      claims: claims.rows,
      protocols: protocols.rows,
      faqs: faqs.rows,
      qa: qa.rows,
      warnings: warnings.rows,
    };
  });
}
