import { getOilEncyclopediaPool, isOilEncyclopediaEnabled } from "./client.ts";
import {
  buildRecommendationCandidatePool,
  rankOilRecommendations,
} from "./recommendation-engine.mjs";
import { readOilGuideCommerceAvailability, type OilGuideCommerceStatus } from "@/server/oil-guide/commerce";

type DbRow = Record<string, unknown>;
type GuideStatus = "ready" | "disabled" | "unavailable";

type EngineCandidate = {
  oilId: string;
  nameFa: string;
  nameEn: string;
  scientificName: string | null;
  recommendationEligible: boolean;
  safetyDecision: string | null;
  concernIds: string[];
  categoryIds: string[];
  areaSlugs: string[];
  oilKind: string | null;
  texture: string | null;
  useFace: string | null;
  useBody: string | null;
  useMassage: string | null;
  useHairShaft: string | null;
  useScalp: string | null;
  useTraditional: string | null;
  useHairTypes: string | null;
  evidenceLevels: string[];
  safetyWarnings: string[];
};

type EngineFactor = {
  key: string;
  weight: number;
  selectedCount: number;
  matchedCount: number;
  points: number;
  matchedIds: string[];
};

type EngineRanked = EngineCandidate & {
  score: number;
  breakdown: EngineFactor[];
  reasonCodes: Array<{ key: string; matchedIds: string[] }>;
};

type RankedOilRecommendation = Omit<OilGuideRecommendation, "commerce">;

type RecommendationReadData = {
  state: "results" | "insufficient_approved_data" | "invalid_answers" | "no_match" | "unavailable";
  totalCanonicalOils: number;
  eligibleOilCount: number;
  recommendations: RankedOilRecommendation[];
  areas: Array<{ slug: string; nameFa: string }>;
  categories: Array<{ id: string; areaSlug: string; nameFa: string }>;
  concerns: Array<{ id: string; categoryId: string; nameFa: string }>;
};

export type QuestionnaireArea = {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  description: string;
  availableOilCount: number;
};

export type QuestionnaireCategory = {
  id: string;
  areaId: string;
  areaSlug: string;
  slug: string;
  nameFa: string;
  nameEn: string | null;
  availableOilCount: number;
};

export type QuestionnaireConcern = {
  id: string;
  categoryId: string;
  categorySlug: string;
  areaSlug: string;
  slug: string;
  nameFa: string;
  nameEn: string | null;
  description: string;
};

export type OilGuideQuestionnaireData = {
  areas: QuestionnaireArea[];
  categories: QuestionnaireCategory[];
  concerns: QuestionnaireConcern[];
  totalCanonicalOils: number;
  eligibleOilCount: number;
  textureOptions: string[];
};

export type OilGuideAnswers = {
  areaSlugs: string[];
  categoryIds: string[];
  concernIds: string[];
  texture: string;
};

export type OilGuideRecommendation = {
  oilId: string;
  nameFa: string;
  nameEn: string;
  scientificName: string | null;
  score: number;
  reasons: string[];
  scoreBreakdown: Array<{
    label: string;
    matchedCount: number;
    selectedCount: number;
    points: number;
    weight: number;
  }>;
  oilKind: string | null;
  texture: string | null;
  verifiedFacts: string[];
  evidenceLevels: string[];
  safetyDecision: "eligible" | "eligible_with_caution";
  safetyWarnings: string[];
  commerce: OilGuideCommerceStatus;
};

export type OilGuideRecommendationResult = {
  status: GuideStatus;
  state: "results" | "insufficient_approved_data" | "invalid_answers" | "no_match" | "unavailable";
  totalCanonicalOils: number;
  eligibleOilCount: number;
  recommendations: OilGuideRecommendation[];
};

const emptyQuestionnaire: OilGuideQuestionnaireData = {
  areas: [],
  categories: [],
  concerns: [],
  totalCanonicalOils: 0,
  eligibleOilCount: 0,
  textureOptions: [],
};

const emptyReadData: RecommendationReadData = {
  state: "unavailable",
  totalCanonicalOils: 0,
  eligibleOilCount: 0,
  recommendations: [],
  areas: [],
  categories: [],
  concerns: [],
};

function valueText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function valueNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapArea(row: DbRow): QuestionnaireArea {
  return {
    id: valueText(row.id),
    slug: valueText(row.slug),
    nameFa: valueText(row.name_fa),
    nameEn: valueText(row.name_en),
    description: valueText(row.description),
    availableOilCount: valueNumber(row.available_oil_count),
  };
}

function mapCategory(row: DbRow): QuestionnaireCategory {
  return {
    id: valueText(row.id),
    areaId: valueText(row.area_id),
    areaSlug: valueText(row.area_slug),
    slug: valueText(row.slug),
    nameFa: valueText(row.name_fa),
    nameEn: typeof row.name_en === "string" ? row.name_en : null,
    availableOilCount: valueNumber(row.available_oil_count),
  };
}

function mapConcern(row: DbRow): QuestionnaireConcern {
  return {
    id: valueText(row.id),
    categoryId: valueText(row.category_id),
    categorySlug: valueText(row.category_slug),
    areaSlug: valueText(row.area_slug),
    slug: valueText(row.slug),
    nameFa: valueText(row.name_fa),
    nameEn: typeof row.name_en === "string" ? row.name_en : null,
    description: valueText(row.description),
  };
}

async function withReadOnly<T>(
  fallback: T,
  query: (client: import("pg").PoolClient) => Promise<T>,
): Promise<{ status: GuideStatus; data: T }> {
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
      try { await client.query("ROLLBACK"); } catch { /* keep the source fail-closed */ }
    }
    return { status: "unavailable", data: fallback };
  } finally {
    client?.release();
  }
}

export async function readOilGuideQuestionnaire() {
  return withReadOnly(emptyQuestionnaire, async (client) => {
    const areas = await client.query(
      "SELECT id, slug, name_fa, name_en, description, available_oil_count " +
      "FROM oil_encyclopedia.public_guide_areas ORDER BY sort_order, name_fa",
    );
    const categories = await client.query(
      "SELECT id, area_id, area_slug, slug, name_fa, name_en, available_oil_count " +
      "FROM oil_encyclopedia.public_guide_categories ORDER BY sort_order, name_fa",
    );
    const concerns = await client.query(
      "SELECT id, category_id, category_slug, area_slug, slug, name_fa, name_en, description " +
      "FROM oil_encyclopedia.public_guide_questionnaire_concerns ORDER BY sort_order, name_fa",
    );
    const stats = await client.query(
      "SELECT COUNT(*)::INTEGER AS total_count, " +
      "COUNT(*) FILTER (WHERE recommendation_eligible IS TRUE)::INTEGER AS eligible_count " +
      "FROM oil_encyclopedia.public_guide_recommendation_candidates",
    );
    const textures = await client.query(
      "SELECT DISTINCT texture FROM oil_encyclopedia.public_guide_recommendation_candidates " +
      "WHERE recommendation_eligible IS TRUE AND texture IS NOT NULL AND btrim(texture) <> '' ORDER BY texture",
    );
    return {
      areas: areas.rows.map(mapArea),
      categories: categories.rows.map(mapCategory),
      concerns: concerns.rows.map(mapConcern),
      totalCanonicalOils: valueNumber(stats.rows[0]?.total_count),
      eligibleOilCount: valueNumber(stats.rows[0]?.eligible_count),
      textureOptions: textures.rows.map((row: DbRow) => valueText(row.texture)).filter(Boolean),
    };
  });
}

function buildReasons(
  item: EngineRanked,
  areas: Array<{ slug: string; nameFa: string }>,
  categories: Array<{ id: string; areaSlug: string; nameFa: string }>,
  concerns: Array<{ id: string; categoryId: string; nameFa: string }>,
  texture: string,
) {
  const areaBySlug = new Map(areas.map((value) => [value.slug, value]));
  const categoryById = new Map(categories.map((value) => [value.id, value]));
  const concernById = new Map(concerns.map((value) => [value.id, value]));
  const reasons: string[] = [];
  for (const reason of item.reasonCodes) {
    if (reason.key === "concern") {
      for (const id of reason.matchedIds) {
        const concern = concernById.get(id);
        if (concern) reasons.push("تطابق با موضوع «" + concern.nameFa + "»");
      }
    } else if (reason.key === "category") {
      for (const id of reason.matchedIds) {
        const category = categoryById.get(id);
        if (category) reasons.push("ارتباط ثبت‌شده با دسته «" + category.nameFa + "»");
      }
    } else if (reason.key === "area") {
      for (const slug of reason.matchedIds) {
        const area = areaBySlug.get(slug);
        if (area) reasons.push("کاربرد ثبت‌شده در ناحیه «" + area.nameFa + "»");
      }
    } else if (reason.key === "texture" && texture) {
      reasons.push("بافت «" + texture + "» با ترجیح شما مطابقت دارد");
    }
  }
  return [...new Set(reasons)];
}

const factorLabels: Record<string, string> = {
  concern: "موضوع انتخابی",
  category: "دسته انتخابی",
  area: "ناحیه انتخابی",
  texture: "بافت ترجیحی",
};

export async function recommendOilGuide(answers: OilGuideAnswers): Promise<OilGuideRecommendationResult> {
  const fallback: OilGuideRecommendationResult = {
    status: isOilEncyclopediaEnabled() ? "unavailable" : "disabled",
    state: "unavailable",
    totalCanonicalOils: 0,
    eligibleOilCount: 0,
    recommendations: [],
  };
  const read = await withReadOnly(emptyReadData, async (client) => {
    const areaRows = await client.query(
      "SELECT slug, name_fa FROM oil_encyclopedia.public_guide_areas ORDER BY sort_order",
    );
    const categoryRows = await client.query(
      "SELECT id, area_slug, name_fa FROM oil_encyclopedia.public_guide_categories ORDER BY sort_order",
    );
    const concernRows = await client.query(
      "SELECT id, category_id, name_fa FROM oil_encyclopedia.public_guide_questionnaire_concerns ORDER BY sort_order",
    );
    const textureRows = await client.query(
      "SELECT DISTINCT texture FROM oil_encyclopedia.public_guide_recommendation_candidates " +
      "WHERE recommendation_eligible IS TRUE AND texture IS NOT NULL AND btrim(texture) <> '' ORDER BY texture",
    );
    const areas = areaRows.rows.map((row: DbRow) => ({
      slug: valueText(row.slug),
      nameFa: valueText(row.name_fa),
    }));
    const categories = categoryRows.rows.map((row: DbRow) => ({
      id: valueText(row.id),
      areaSlug: valueText(row.area_slug),
      nameFa: valueText(row.name_fa),
    }));
    const concerns = concernRows.rows.map((row: DbRow) => ({
      id: valueText(row.id),
      categoryId: valueText(row.category_id),
      nameFa: valueText(row.name_fa),
    }));
    const textures = textureRows.rows.map((row: DbRow) => valueText(row.texture)).filter(Boolean);
    const areaSet = new Set(areas.map((item) => item.slug));
    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    const concernMap = new Map(concerns.map((item) => [item.id, item]));
    const valid = answers.areaSlugs.length > 0 && answers.categoryIds.length > 0 &&
      answers.areaSlugs.every((slug) => areaSet.has(slug)) &&
      answers.categoryIds.every((id) => categoryMap.has(id) && answers.areaSlugs.includes(categoryMap.get(id)!.areaSlug)) &&
      answers.concernIds.every((id) => concernMap.has(id) && answers.categoryIds.includes(concernMap.get(id)!.categoryId)) &&
      (!answers.texture || textures.includes(answers.texture));
    if (!valid) {
      return {
        state: "invalid_answers" as const,
        totalCanonicalOils: 0,
        eligibleOilCount: 0,
        recommendations: [],
        areas,
        categories,
        concerns,
      };
    }

    const candidateRows = await client.query(
      "SELECT oil_id, oil_name_fa, oil_name_en, scientific_name, recommendation_eligible, safety_decision, " +
      "concern_ids, category_ids, area_slugs, oil_kind, texture, use_face, use_body, use_massage, " +
      "use_hair_shaft, use_scalp, use_traditional, use_hair_types, evidence_levels, safety_warnings " +
      "FROM oil_encyclopedia.public_guide_recommendation_candidates ORDER BY oil_id",
    );
    const candidates = buildRecommendationCandidatePool(candidateRows.rows as DbRow[]) as EngineCandidate[];
    const eligibleOilCount = candidates.filter((item) => item.recommendationEligible === true).length;
    const ranked = rankOilRecommendations(candidates, answers) as EngineRanked[];
    const recommendations: RankedOilRecommendation[] = ranked.map((item) => ({
      oilId: item.oilId,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      scientificName: item.scientificName,
      score: item.score,
      reasons: buildReasons(item, areas, categories, concerns, answers.texture),
      scoreBreakdown: item.breakdown.map((factor) => ({
        label: factorLabels[factor.key] ?? factor.key,
        matchedCount: factor.matchedCount,
        selectedCount: factor.selectedCount,
        points: factor.points,
        weight: factor.weight,
      })),
      oilKind: item.oilKind,
      texture: item.texture,
      verifiedFacts: [
        item.oilKind ? "نوع روغن ثبت‌شده: " + item.oilKind : "",
        item.texture ? "بافت ثبت‌شده: " + item.texture : "",
        item.useFace ? "کاربرد ثبت‌شده برای پوست صورت: " + item.useFace : "",
        item.useBody ? "کاربرد ثبت‌شده برای پوست بدن: " + item.useBody : "",
        item.useMassage ? "کاربرد ثبت‌شده برای ماساژ: " + item.useMassage : "",
        item.useHairShaft ? "کاربرد ثبت‌شده برای ساقه مو: " + item.useHairShaft : "",
        item.useScalp ? "کاربرد ثبت‌شده برای پوست سر: " + item.useScalp : "",
        item.useTraditional ? "کاربرد سنتی/موضعی ثبت‌شده: " + item.useTraditional : "",
        item.useHairTypes ? "انواع موی ثبت‌شده: " + item.useHairTypes : "",
      ].filter(Boolean),
      evidenceLevels: item.evidenceLevels,
      safetyDecision: item.safetyDecision as "eligible" | "eligible_with_caution",
      safetyWarnings: item.safetyWarnings,
    }));
    const totalCanonicalOils = candidates.length;
    const state = recommendations.length === 3
      ? "results" as const
      : eligibleOilCount < 3
        ? "insufficient_approved_data" as const
        : "no_match" as const;
    return {
      state,
      totalCanonicalOils,
      eligibleOilCount,
      recommendations,
      areas,
      categories,
      concerns,
    };
  });

  if (read.status !== "ready") return { ...fallback, status: read.status };
  if (read.data.state === "invalid_answers") {
    return {
      status: "ready",
      state: "invalid_answers",
      totalCanonicalOils: 0,
      eligibleOilCount: 0,
      recommendations: [],
    };
  }
  if (read.data.recommendations.length !== 3) {
    return {
      status: "ready",
      state: read.data.state,
      totalCanonicalOils: read.data.totalCanonicalOils,
      eligibleOilCount: read.data.eligibleOilCount,
      recommendations: [],
    };
  }

  let commerceByOil = new Map<string, OilGuideCommerceStatus>();
  try {
    commerceByOil = await readOilGuideCommerceAvailability(read.data.recommendations.map((item) => item.oilId));
  } catch {
    // Storefront status is optional and must not block or alter knowledge ranking.
    commerceByOil = new Map(read.data.recommendations.map((item) => [
      item.oilId,
      { availability: "unavailable" as const, productHref: null },
    ]));
  }
  const recommendations: OilGuideRecommendation[] = read.data.recommendations.map((item) => ({
    ...item,
    commerce: commerceByOil.get(item.oilId) ?? { availability: "not_mapped", productHref: null },
  }));
  return {
    status: "ready",
    state: "results",
    totalCanonicalOils: read.data.totalCanonicalOils,
    eligibleOilCount: read.data.eligibleOilCount,
    recommendations,
  };
}
