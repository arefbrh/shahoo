/**
 * Deterministic, explainable Oil Guide compatibility ranking.
 *
 * The candidate universe comes only from canonical encyclopedia oil rows.
 * Storefront products/stock are deliberately handled by attachCommerceMetadata
 * after ranking and are never accepted by the scoring function.
 *
 * @typedef {Record<string, unknown>} RawOilRow
 * @typedef {{
 *   oilId: string,
 *   nameFa: string,
 *   nameEn: string,
 *   scientificName: string | null,
 *   recommendationEligible: boolean,
 *   safetyDecision: string | null,
 *   concernIds: string[],
 *   categoryIds: string[],
 *   areaSlugs: string[],
 *   oilKind: string | null,
 *   texture: string | null,
 *   useFace: string | null,
 *   useBody: string | null,
 *   useMassage: string | null,
 *   useHairShaft: string | null,
 *   useScalp: string | null,
 *   useTraditional: string | null,
 *   useHairTypes: string | null,
 *   evidenceLevels: string[],
 *   safetyWarnings: string[]
 * }} RecommendationCandidate
 * @typedef {{key: "concern" | "category" | "area" | "texture", weight: number, selected: string[]}} ScoreFactor
 * @typedef {{key: string, weight: number, selectedCount: number, matchedCount: number, points: number, matchedIds: string[]}} ScoreBreakdown
 * @typedef {{key: string, matchedIds: string[]}} ReasonCode
 * @typedef {{concernIds?: string[], categoryIds?: string[], areaSlugs?: string[], texture?: string}} RecommendationAnswers
 * @typedef {{availability: "not_mapped" | "available" | "out_of_stock" | "unavailable", productHref: string | null}} CommerceStatus
 */

const WEIGHTS = Object.freeze({
  concern: 60,
  category: 25,
  area: 10,
  texture: 5,
});

/** @param {unknown} value */
function strings(value) {
  if (!Array.isArray(value)) return [];
  /** @type {string[]} */
  const normalized = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) normalized.push(item.trim());
  }
  return [...new Set(normalized)];
}

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {RawOilRow} row
 * @returns {RecommendationCandidate}
 */
function asCandidate(row) {
  return {
    oilId: text(row.oilId ?? row.oil_id),
    nameFa: text(row.nameFa ?? row.oil_name_fa),
    nameEn: text(row.nameEn ?? row.oil_name_en),
    scientificName: text(row.scientificName ?? row.scientific_name) || null,
    recommendationEligible: row.recommendationEligible === true || row.recommendation_eligible === true,
    safetyDecision: text(row.safetyDecision ?? row.safety_decision) || null,
    concernIds: strings(row.concernIds ?? row.concern_ids),
    categoryIds: strings(row.categoryIds ?? row.category_ids),
    areaSlugs: strings(row.areaSlugs ?? row.area_slugs),
    oilKind: text(row.oilKind ?? row.oil_kind) || null,
    texture: text(row.texture) || null,
    useFace: text(row.useFace ?? row.use_face) || null,
    useBody: text(row.useBody ?? row.use_body) || null,
    useMassage: text(row.useMassage ?? row.use_massage) || null,
    useHairShaft: text(row.useHairShaft ?? row.use_hair_shaft) || null,
    useScalp: text(row.useScalp ?? row.use_scalp) || null,
    useTraditional: text(row.useTraditional ?? row.use_traditional) || null,
    useHairTypes: text(row.useHairTypes ?? row.use_hair_types) || null,
    evidenceLevels: strings(row.evidenceLevels ?? row.evidence_levels),
    safetyWarnings: strings(row.safetyWarnings ?? row.safety_warnings),
  };
}

/**
 * Retains one row per canonical oil ID. This intentionally does not consult
 * product IDs, mappings, publication state in the storefront, or inventory.
 * @param {RawOilRow[]} canonicalOilRows
 * @returns {RecommendationCandidate[]}
 */
export function buildRecommendationCandidatePool(canonicalOilRows) {
  /** @type {Map<string, RecommendationCandidate>} */
  const byId = new Map();
  for (const row of Array.isArray(canonicalOilRows) ? canonicalOilRows : []) {
    const candidate = asCandidate(row);
    if (!candidate.oilId) continue;
    const existing = byId.get(candidate.oilId);
    if (!existing) {
      byId.set(candidate.oilId, candidate);
      continue;
    }
    existing.concernIds = strings([...existing.concernIds, ...candidate.concernIds]);
    existing.categoryIds = strings([...existing.categoryIds, ...candidate.categoryIds]);
    existing.areaSlugs = strings([...existing.areaSlugs, ...candidate.areaSlugs]);
    existing.evidenceLevels = strings([...existing.evidenceLevels, ...candidate.evidenceLevels]);
    existing.safetyWarnings = strings([...existing.safetyWarnings, ...candidate.safetyWarnings]);
    existing.recommendationEligible ||= candidate.recommendationEligible;
    existing.nameFa ||= candidate.nameFa;
    existing.nameEn ||= candidate.nameEn;
    existing.scientificName ||= candidate.scientificName;
    existing.oilKind ||= candidate.oilKind;
    existing.texture ||= candidate.texture;
    existing.useFace ||= candidate.useFace;
    existing.useBody ||= candidate.useBody;
    existing.useMassage ||= candidate.useMassage;
    existing.useHairShaft ||= candidate.useHairShaft;
    existing.useScalp ||= candidate.useScalp;
    existing.useTraditional ||= candidate.useTraditional;
    existing.useHairTypes ||= candidate.useHairTypes;
    if (candidate.safetyDecision === "excluded" || existing.safetyDecision === "excluded") {
      existing.safetyDecision = "excluded";
    } else if (candidate.safetyDecision === "eligible_with_caution" || existing.safetyDecision === "eligible_with_caution") {
      existing.safetyDecision = "eligible_with_caution";
    } else {
      existing.safetyDecision ||= candidate.safetyDecision;
    }
  }
  return [...byId.values()].sort((a, b) => a.oilId < b.oilId ? -1 : a.oilId > b.oilId ? 1 : 0);
}

/** @param {string[]} selected @param {string[]} available */
function overlap(selected, available) {
  const selectedSet = new Set(selected);
  return available.filter((value) => selectedSet.has(value));
}

/** @param {string[]} matched @param {string[]} selected */
function ratio(matched, selected) {
  return selected.length ? matched.length / selected.length : 0;
}

/**
 * Returns exactly three ranked oils when at least three reviewed, safe and
 * explainable candidates match. Otherwise it returns an empty list rather
 * than padding the result with unsupported oils.
 * @param {RecommendationCandidate[]} candidates
 * @param {RecommendationAnswers} answers
 * @returns {Array<RecommendationCandidate & {score: number, breakdown: ScoreBreakdown[], reasonCodes: ReasonCode[]}>}
 */
export function rankOilRecommendations(candidates, answers) {
  const selected = {
    concernIds: strings(answers?.concernIds),
    categoryIds: strings(answers?.categoryIds),
    areaSlugs: strings(answers?.areaSlugs),
    texture: text(answers?.texture),
  };
  /** @type {ScoreFactor[]} */
  const applicable = [
    { key: "concern", weight: WEIGHTS.concern, selected: selected.concernIds },
    { key: "category", weight: WEIGHTS.category, selected: selected.categoryIds },
    { key: "area", weight: WEIGHTS.area, selected: selected.areaSlugs },
    { key: "texture", weight: WEIGHTS.texture, selected: selected.texture ? [selected.texture] : [] },
  ].filter((factor) => factor.selected.length > 0);
  const totalWeight = applicable.reduce((sum, factor) => sum + factor.weight, 0);
  if (totalWeight === 0) return [];

  /** @type {Array<RecommendationCandidate & {score: number, breakdown: ScoreBreakdown[], reasonCodes: ReasonCode[]}>} */
  const ranked = [];
  for (const candidate of candidates) {
    if (
      candidate.recommendationEligible !== true ||
      !candidate.oilId ||
      !candidate.nameFa ||
      !["eligible", "eligible_with_caution"].includes(candidate.safetyDecision ?? "") ||
      (candidate.safetyDecision === "eligible_with_caution" && candidate.safetyWarnings.length === 0)
    ) continue;

    const matches = {
      concern: overlap(selected.concernIds, candidate.concernIds),
      category: overlap(selected.categoryIds, candidate.categoryIds),
      area: overlap(selected.areaSlugs, candidate.areaSlugs),
      texture: selected.texture ? (candidate.texture === selected.texture ? [selected.texture] : []) : [],
    };
    let weightedPoints = 0;
    /** @type {ScoreBreakdown[]} */
    const breakdown = [];
    for (const factor of applicable) {
      const matched = matches[factor.key];
      const factorRatio = ratio(matched, factor.selected);
      const points = factor.weight * factorRatio;
      weightedPoints += points;
      breakdown.push({
        key: factor.key,
        weight: factor.weight,
        selectedCount: factor.selected.length,
        matchedCount: matched.length,
        points: Math.round(points * 100) / 100,
        matchedIds: matched,
      });
    }
    const score = Math.round((weightedPoints / totalWeight) * 100);
    if (score <= 0) continue;
    ranked.push({
      ...candidate,
      score,
      breakdown,
      reasonCodes: breakdown.filter((item) => item.matchedCount > 0).map((item) => ({
        key: item.key,
        matchedIds: item.matchedIds,
      })),
    });
  }

  ranked.sort((a, b) => b.score - a.score || (a.oilId < b.oilId ? -1 : a.oilId > b.oilId ? 1 : 0));
  return ranked.length >= 3 ? ranked.slice(0, 3) : [];
}

/**
 * Adds commerce information after ranking. Missing or unavailable products
 * never remove an oil, alter its score, or change its rank.
 * @param {Array<RecommendationCandidate & {score: number, breakdown: ScoreBreakdown[], reasonCodes: ReasonCode[]}>} recommendations
 * @param {Map<string, CommerceStatus>} [commerceByOil]
 */
export function attachCommerceMetadata(recommendations, commerceByOil = new Map()) {
  return recommendations.map((recommendation) => {
    const commerce = commerceByOil instanceof Map ? commerceByOil.get(recommendation.oilId) : null;
    return {
      ...recommendation,
      commerce: commerce ?? { availability: "not_mapped", productHref: null },
    };
  });
}

export const recommendationWeights = WEIGHTS;
