# SHAHOO Oil Guide — Product, Recommendation & Design Handoff

**Purpose:** This document is the authoritative handoff for the next AI agent that will redesign and continue the Oil Guide. It records the current implementation as a preserved baseline, the product owner's clarified expectations, the encyclopedia/data constraints, and the acceptance criteria.  
**Repository:** `shahoo-workspace/shahoo`  
**Current implementation branch:** `feat/oil-guide-taxonomy-discovery`  
**Related PR:** [#45 — database-driven taxonomy discovery](https://github.com/shahoo-workspace/shahoo/pull/45)  
**Related Issue:** [#37 — Oil Encyclopedia integration](https://github.com/shahoo-workspace/shahoo/issues/37)  
**Source database:** SHAHOO Oil Encyclopedia v3.2 (41 canonical oils)

---

## 1. Owner's clarified product direction

The current implementation is a useful technical baseline, but **its current visual design and interaction are not the desired final customer experience**. Keep the existing work in GitHub and do not discard it. The next agent is expected to study it, preserve reusable architecture and data work, and substantially improve the customer-facing experience.

The Oil Guide is primarily a **personalized oil recommendation tool for customers**, not merely an encyclopedia browser, a directory of categories, or a filter over products currently for sale.

The main outcome is:

> After answering a guided set of relevant questions, a customer receives exactly three distinct oil recommendations, ranked from best match to third-best match, with a transparent compatibility score and a clear explanation of why each oil matches.

The guide must consider **all 41 canonical oils in Encyclopedia v3.2**, whether or not a matching product/SKU currently exists in the SHAHOO storefront. Store inventory is not a recommendation eligibility condition and must never silently remove an oil from the candidate pool or change its rank.

A recommended oil that is not currently sold can still be useful to the customer. Its card/profile should remain visible, while the purchase action may be replaced with a neutral availability message (for example, «فعلاً در فروشگاه موجود نیست»). If a product mapping exists, it may link to the corresponding product. Product mapping and stock availability are separate commerce metadata, not evidence of suitability.

## 2. What exists today — preserve as the baseline, not as the final design

PR #45 adds a database-driven taxonomy/discovery layer alongside the existing recommendation wizard.

Current implementation includes:

- New guide taxonomy tables in the separate `oil_encyclopedia` schema: `guide_areas`, `guide_categories`, `guide_concerns`, and `oil_guide_mappings`.
- Three initial areas: Hair, Skin, and Topical Use.
- Five source-backed category values derived from v3.2 `Applications.category`: `ساقه مو`, `ریشه مو و پوست سر`, `پوست`, `سنتی و موضعی`, and `ماساژ`.
- Concern records tied to canonical `Applications.app_id` values.
- Oil-to-category/concern mappings tied to canonical `oil_id` and supporting `Problem_Oil_Map.map_id`; mappings are not inferred by matching names.
- Server-side read functions and nested routes for area, category, concern, search and canonical oil profiles.
- A discovery landing page and the existing quick recommender. The current landing page renders the discovery experience first and the old product-only recommender below it.
- Public guide views with publication gates. The public website does not query internal research tables directly.
- A separate read-only database access path; no fallback to the storefront database.

Relevant source paths in the current branch include:

- `scripts/import-oil-encyclopedia.mjs` — source import and guide taxonomy DDL/seeding.
- `src/server/oil-encyclopedia/client.ts` and `src/server/oil-encyclopedia/guide.ts` — separate encyclopedia connection and read-only guide queries.
- `src/components/site/oil-guide-discovery.tsx` — current discovery UI (a baseline to redesign).
- `src/routes/oil-guide.index.tsx` and the other `src/routes/oil-guide.*.tsx` routes — route structure.
- `src/components/site/oil-guide.tsx` and `src/server/oil-guide/*` — existing storefront/product-oriented quick recommender. Review before reusing or replacing it.

Do not assume the current layout, landing-page hierarchy, card design, or two-experience split is the owner's final preference. Rework the interaction around the customer recommendation journey.

## 3. The 41-oil candidate pool — a critical requirement

The candidate set must be the canonical 41 oils from the encyclopedia, not the current three storefront oil products.

Implement and test the following separation:

1. **Knowledge identity:** the canonical oil record and its v3.2 profile.
2. **Recommendation eligibility:** whether the oil has sufficient reviewed, safe, structured information to participate in the recommendation algorithm.
3. **Customer-facing content publication:** whether the facts, claims, instructions, safety text and profile sections are approved for display.
4. **Commerce availability:** whether a storefront product is explicitly mapped and whether it is currently active/in stock.

These are four different concepts. Do not conflate them.

Requirements:

- Build the recommendation candidate pool from the encyclopedia's canonical oil records and approved recommendation attributes. Do not inner-join to the storefront product table as a prerequisite.
- Do not require an `oil_product_links` row for an oil to be recommended.
- Do not filter by product active status, inventory quantity, product publication status, or current storefront catalog size.
- Keep any product association explicit and many-to-many where appropriate. Never guess a product mapping from similar names.
- Return the oil's canonical ID in recommendation results so the same oil is deduplicated even when it matches multiple selected concerns/categories.
- If an oil is not for sale, keep its recommendation and explain availability separately.
- Test explicitly that a candidate pool containing 41 eligible oils still contains 41 oils when the storefront contains only 0, 3, or a different number of mapped oil products.

### Publication and safety gates must remain intact

The current v3.2 snapshot has important limitations:

- 41 `Oil_Profiles` currently have `customer_display_allowed=false`.
- The source snapshot has no final-approved oil profile/safety dossier.
- The 793 `Problem_Oil_Map` records are not customer-display approved.
- Existing public views intentionally return no customer-visible oil rows until their approval gates are satisfied.

Therefore, the next agent must **not bypass the publication gates** just to make all 41 appear. Design a safe, explicit review path for the structured fields used by recommendation scoring (if that is distinct from full customer profile publication). The server may use only fields that have been explicitly approved for that purpose. Customer-facing explanations, claims, instructions and safety statements must use their own approved public fields. Never expose raw research tables, pending claims, unpublished protocols, or unreviewed safety data.

The product requirement is that all 41 oils are considered independently of store inventory. A genuine safety or data-approval restriction is different from a missing SKU. If fewer than three oils are legitimately eligible because approval/safety data is missing, do not fabricate recommendations or silently lower safety standards. Surface the data-readiness gap to maintainers and provide a clear, safe customer state until the missing review is completed.

## 4. Customer questionnaire and taxonomy

The questionnaire should ask about the categories and concerns already present in the encyclopedia, and may become more detailed where the source data genuinely supports it.

Initial taxonomy:

### Areas
- Hair — مو
- Skin — پوست
- Topical use — کاربرد موضعی

### Source-backed categories
- Hair shaft — ساقه مو
- Hair roots and scalp — ریشه مو و پوست سر
- Skin — پوست
- Traditional and topical — سنتی و موضعی
- Massage — ماساژ

The source currently combines roots and scalp. Do not split them into separate categories unless the source data and reviewed taxonomy support that change. Do not invent categories such as hair ends, feet, nails, or other body parts merely to make the menu look comprehensive.

### Questionnaire design direction

Create a customer-friendly, progressive, multi-step flow. Ask enough to improve matching, but do not overwhelm customers with a giant form. Use a short core path with optional «جزئیات بیشتر» questions. Support multi-select where a customer may have more than one concern.

Consider the following sequence, adapting the exact questions and available choices to the verified data:

1. **What area are you interested in?** Hair, skin, topical use; allow multiple areas only if the recommendation model can correctly handle them.
2. **Which category applies?** Show relevant source-backed categories based on the selected area.
3. **What are your goals or concerns?** Load the actual concern records derived from `Applications`; allow one or multiple concerns.
4. **Relevant personal characteristics:** ask about hair type/condition for hair journeys or skin type/condition for skin journeys only when the encyclopedia contains reviewed attributes that can use those answers. Do not ask irrelevant questions.
5. **Desired feel/texture and product preference:** lightweight/heavy feel, absorption or other preferences only where the profile data supports a meaningful match.
6. **Use context:** intended application area and use context only when supported by approved protocols. Do not invent dosage, frequency, duration, leave-on/rinse-off instructions.
7. **Sensitivity and exclusions:** allow the customer to report known sensitivities/allergies and exclude oils or ingredients where reliable reviewed safety data supports the exclusion. Never infer that an oil is safe merely because no warning was found.
8. **Optional advanced preferences:** present secondary questions behind a progressive disclosure control; unanswered optional questions must not block results.

Question order and wording should be tested on mobile first, in Persian RTL. Make the current step, progress, selected answers, back/edit action and final submit action obvious. Preserve answers when navigating backward. Avoid a long unstructured scroll.

Do not make up customer concerns. Use canonical source concerns and clearly label any editorially authored UX wording. English translations of labels are navigation copy, not new scientific properties.

## 5. Recommendation output — exactly three ranked oils

The primary result screen must return **three unique oils**, ranked:

1. Best match
2. Second-best match
3. Third-best match

Each result should include, where approved and available:

- Persian and English oil name.
- A clear rank (۱، ۲، ۳).
- A compatibility score on a 0–100 scale.
- A plain-language explanation of the match tied to the customer's actual answers and approved source records.
- Relevant selected category/concern tags.
- Evidence level or evidence-quality label where the source supports it, with a customer-understandable explanation.
- Key approved characteristics relevant to the choice.
- Safety/usage caveat only from reviewed and publishable safety/protocol data.
- Commerce availability separately from recommendation suitability.
- Link to a product only when an explicit canonical oil-to-product mapping exists and the product is available.

### Score semantics — do not mislead

The owner describes the desired ranking in terms of a percentage of effectiveness. Do not present an unvalidated model score as a clinically proven efficacy percentage or a probability of success.

Use a transparent label such as **«امتیاز تطابق»** or **«درصد تطابق با انتخاب‌های شما»**. It is a rule-based compatibility score, not a medical efficacy guarantee. The UI must explain this distinction briefly.

The scoring model must be:

- Deterministic and server-side.
- Based only on approved structured data and the customer's submitted answers.
- Explainable: the system must be able to say which answers and data attributes increased or decreased a score.
- Configurable and documented; avoid unexplained magic constants.
- Tested for missing/null data, multiple concerns, duplicate mappings, ties, conflicting preferences and safety exclusions.
- Independent of stock and storefront product availability.

Do not invent numeric weights or pretend they are scientifically validated. Propose a sensible initial weighted model, document the rationale, and keep weights/configuration easy to review. A possible structure is to combine: exact concern match, selected area/category match, relevant profile attribute match, preference match, evidence quality and safety eligibility. Safety should be a hard eligibility/exclusion gate, not a positive score that can be outweighed by relevance. Missing information should not be treated as a positive match.

Sort by score descending with deterministic tie-breakers. Deduplicate by canonical oil ID. The result should contain exactly three distinct oils whenever at least three eligible candidates exist. If fewer than three can safely be returned, do not fabricate or pad the list; record the reason as a data-readiness issue.

## 6. UX and visual design brief for the next agent

The next agent has freedom to improve the visual design substantially. The current UI is not a design constraint.

Design goals:

- Persian-first, polished, trustworthy, premium botanical/natural identity consistent with SHAHOO.
- Mobile-first and excellent on narrow iPhone screens; responsive desktop layout.
- RTL correctness, clear typography, adequate whitespace and strong visual hierarchy.
- The recommendation questionnaire is the main entry point and primary call to action.
- Do not make customers browse a deep taxonomy tree before they can get a recommendation.
- Keep encyclopedia browsing/search and detailed oil profiles available as secondary paths, not as a substitute for the recommendation flow.
- Results should make the top recommendation visually clear while still allowing easy comparison of all three.
- Show score meaning and the reasons for each recommendation; do not rely on decorative percentage circles without explanation.
- Make availability status secondary to suitability; an unavailable oil must not be visually demoted in rank.
- Include useful empty, loading, disabled-source, unavailable-source, validation and insufficient-approved-data states.
- Avoid clutter, unnecessary animations, excessive gradients, generic template-like cards and long walls of text.
- Use the existing SHAHOO design tokens, components, typography and approved brand assets. Do not introduce an unrelated design system.

The agent should first inspect the whole current Oil Guide flow on mobile and desktop, then propose and implement a coherent interaction/design rather than polishing isolated cards.

## 7. Data model and API expectations

Keep the existing normalized taxonomy and canonical IDs unless a concrete defect requires a reviewed migration.

Recommended logical boundaries:

- Taxonomy: areas, categories, concerns and their parent/child hierarchy.
- Canonical oil profile: one identity per encyclopedia oil.
- Recommendation attributes: reviewed structured fields permitted for scoring.
- Recommendation mapping: oil-to-concern/category relationships with source-record provenance, evidence and review state.
- Customer-visible evidence: approved claims, public profile attributes, approved protocols and safety warnings.
- Commerce mapping: explicit canonical oil ID to storefront product ID; never a prerequisite for recommendation.

The recommendation API should accept validated, bounded answer IDs/values—not arbitrary SQL filters or free-form instructions. It should return three ranked canonical oil IDs plus score, score explanation codes and only approved customer-display fields. Keep the scoring implementation server-side. Do not send internal table contents or unpublished research to the browser.

The UI must not query Neon directly. Continue using validated TanStack Start server functions and the separate encyclopedia connection. Do not fall back to the storefront `DATABASE_URL`. Keep read-only access and least-privilege grants.

If a schema migration is required for recommendation eligibility/review state, add it to the isolated encyclopedia importer/migration workflow, document rollback/verification, and keep all new rows hidden until reviewed. Never auto-approve imported records.

## 8. Required tests and acceptance criteria

The next PR is not complete until it demonstrates:

### Candidate-pool correctness
- The source of candidates is all 41 canonical encyclopedia oils, not `listOilProducts()`.
- All 41 can be considered even if no storefront product exists.
- Changing storefront stock or removing product mappings does not change recommendation candidates or scores.
- Explicit product mapping controls only the optional purchase link/availability label.
- Duplicate concern mappings never duplicate an oil in the three results.

### Questionnaire correctness
- Areas/categories/concerns come from canonical taxonomy data.
- Only valid active IDs are accepted by the server.
- Multi-select, back navigation, optional unanswered questions and mobile layout work.
- No unsupported category, benefit, safety claim or usage instruction is fabricated.

### Ranking correctness
- Exactly three unique oils are returned when at least three eligible candidates exist.
- Rank order is deterministic and descending by compatibility score.
- Safety exclusions are hard gates.
- Missing evidence/attributes do not create a positive match.
- Each result has traceable reason codes linked to the customer's answers and approved source data.
- The displayed score is explicitly described as compatibility, not proven efficacy.

### Publication/security correctness
- No unapproved public content is exposed.
- Existing public views and read-only role restrictions remain enforced.
- Disabled/unavailable database states fail closed.
- No secrets or internal research data are exposed to the client or logs.

### Quality and delivery
- Typecheck, lint, project tests and build pass on the final commit.
- Add focused unit/integration tests for the recommendation algorithm and 41-oil candidate-pool behavior.
- Update the existing Project Master Report and this handoff only as needed; do not create duplicate status reports.
- Work in a new branch/PR based on the latest appropriate branch; do not push directly to `main`.
- Do not merge to `main`, change Production, import to shared databases, enable Vercel secrets/features or deploy Production without separate owner approval.

## 9. Current operational status and limitations

As recorded in the existing project handoff:

- The v3.2 source contains 41 canonical oils.
- The isolated Neon branch `oil-encyclopedia-v32-integration` exists; migration #0020 and the read-only group role exist there.
- The full v3.2 import has **not** been run.
- The `oil_encyclopedia` schema/full source data and new taxonomy have not yet been imported into that branch.
- A dedicated read-only LOGIN user has not been created.
- No `OIL_ENCYCLOPEDIA_DATABASE_URL` or enable flag has been configured in Vercel.
- The feature remains disabled by default.
- PR #45 contains the code baseline; the Staging preview recorded in the existing handoff is intentionally showing the disabled-source state because it has no encyclopedia connection.
- No Production import, migration, feature activation or deployment is approved by this document.

The next agent should verify these facts against the live GitHub/Neon/Vercel state before acting; this file is a handoff, not proof that an operational step has since completed.

## 10. Instructions to the next agent

1. Read `AGENTS.md`, `PROJECT_HANDOFF.md`, `docs/PROJECT_MASTER_REPORT.md`, Issue #37, PR #45 and this document.
2. Inspect the current Oil Guide routes, components, server functions, importer, tests and storefront recommender before changing code.
3. Preserve the current implementation in GitHub. Do not delete the discovery/taxonomy work simply because the UI is being redesigned.
4. Reframe the primary customer journey around the guided questionnaire and three ranked recommendations from the 41-oil encyclopedia.
5. Separate candidate eligibility, public-content approval and commerce availability as described above.
6. Prepare a concise UX flow/wireframe in the PR description or issue discussion, then implement the approved direction in code. The owner wants a better design, not just another written proposal.
7. Add tests proving that all 41 canonical oils are considered independently of the storefront product catalog.
8. Report clearly what is implemented, what is only prepared, what remains blocked by missing data approvals/import, and what was actually tested.
9. Keep work on a feature branch and open/update a PR. Do not merge or deploy Production.

**Most important acceptance statement:** A customer must be able to answer relevant, source-backed questions and receive three distinct, transparently ranked oil recommendations from the encyclopedia's 41-oil knowledge base, regardless of whether those oils are currently listed or in stock in the SHAHOO shop. The customer experience should be redesigned around this outcome.


---

## 11. Guided recommender implementation — 2026-11-27

The implementation is being continued on `feat/oil-guide-guided-recommendations`, created from the inspected PR #45 head `bc726036d3e185d02113dc10dc4e8c91ba2ed80f`. PR #45 remains open and unchanged.

### Customer experience

- `/oil-guide` now leads with a Persian RTL, mobile-first progressive questionnaire rather than the old product-only recommender or a taxonomy directory.
- The customer selects one or more source-backed areas, then relevant categories, optionally approved concerns, and an optional texture only when reviewed candidate data actually supplies texture values.
- Answers survive back/edit navigation. The flow has progress, multi-select, optional steps, loading, disabled/unavailable-source, insufficient-approved-data and no-match states.
- The result component is designed for exactly three distinct ranked oils. It displays a 0–100 compatibility score, answer-linked reasons, factor breakdown, reviewed profile facts, approved safety warnings, evidence labels where present, and separate commerce availability.
- The existing taxonomy pages/search remain a secondary browse path. The old storefront-only recommender component is retained in the repository but is no longer the primary Oil Guide experience.

### Recommendation candidate and review architecture

The importer now creates two additional read-only guide views and an explicit review table:

- `guide_recommendation_reviews`: one pending review row is seeded for every canonical row in `oil_encyclopedia.oils`. Defaults are `review_status=needs_human_review`, `safety_decision=pending`, and `display_status=hidden`. Its narrow name/attribute snapshot fields are NULL by default and must be copied from source and reviewed by an authorized human; import never auto-populates or approves them.
- `public_guide_questionnaire_concerns`: exposes only concern labels whose separate taxonomy review is approved and published.
- `public_guide_recommendation_candidates`: starts from the full canonical `oils` table and LEFT JOINs the recommendation review. It returns the canonical oil ID for every source oil, but returns names and structured profile fields only after the separate recommender review is approved and published.

A recommendation candidate becomes eligible only when all of the following are true:

1. The oil's recommendation-specific review is approved, has a reviewer and timestamp, and its explicit safety decision is `eligible` or `eligible_with_caution`.
2. The limited recommendation display is published; the approved projection is restricted to the name and structured fields used by the questionnaire/result.
3. At least one source-provenanced `oil_guide_mappings` relationship has human review approval, joins to an approved/published questionnaire concern and its source `Problem_Oil_Map` row, and also passes the source `public_problem_oils` final-signoff view.
4. A caution decision has at least one approved customer-facing safety warning.

This is deliberately separate from full `public_oil_profiles` publication: the limited recommender snapshot is separately transcribed/reviewed and does not depend on the full profile display approval. The source `public_problem_oils` final-signoff gate is still required for every concern mapping. The new concern-label review gate applies only to the new questionnaire/recommender views; the existing PR #45 `public_guide_oils` browse projection retains its prior behavior. Detailed encyclopedia browse/profile pages continue to require their existing full profile and public mapping sign-offs; those gates are not bypassed. The read-only web role receives SELECT only on the approved guide views, never on the review table, base profile/research tables, or raw taxonomy tables.

The candidate view has no join to storefront products, `oil_product_links`, variants or inventory. Therefore it can return all 41 canonical IDs even if the shop has only three products (or none). The storefront lookup is a separate post-ranking enrichment for the three selected results only.

### Scoring behavior

The initial configurable weights are:

| Answer factor | Weight |
|---|---:|
| Exact approved concern relationship | 60 |
| Approved category relationship | 25 |
| Approved area relationship | 10 |
| Exact reviewed texture preference | 5 |

Only factors the customer actually answered participate in the denominator. For multi-select factors, the earned fraction is the number of selected values matched by the oil divided by the number selected. Missing oil attributes earn zero for that answered factor; missing data is never a positive match. Scores are rounded to an integer and normalized across answered factors.

Safety is an eligibility gate, not a score bonus. Oils are deduplicated by canonical ID. Results sort by score descending and then canonical oil ID for deterministic ties. The engine returns three only when at least three eligible oils have a positive match; it never pads the list. The displayed value is a rule-based compatibility score, not clinical efficacy or probability.

### Tests and current operational boundary

- `scripts/oil-guide-recommendations.test.mjs` covers the 41-candidate/three-store-products scenario, a recommended oil with no storefront mapping, deduplication, hard safety exclusions, missing attributes, deterministic ranking and the fewer-than-three case.
- `scripts/oil-guide-taxonomy.test.mjs` covers the isolated review tables/views, publication gates, canonical-oil-rooted candidate view and absence of storefront/inventory dependencies.
- The v3.2 import, recommendation review approvals, questionnaire concern approvals and recommendation mapping approvals have not been run or granted in a live database. The current source snapshot has no final-approved full oil profiles or public problem-oil mappings. Until the separate recommender fields/relationships are explicitly reviewed, the live customer flow must show the honest insufficient-approved-data state rather than fabricate results.
- No shared database import, Vercel secret/flag change, Staging feature activation, Production change, merge or Production deployment is part of this implementation.


### Controlled data-review sequence (not executed)

The importer only creates the 41 pending queue rows. It does not populate or approve the customer-facing snapshot. An authorized encyclopedia reviewer must work one canonical oil at a time:

1. Verify the source identity and each proposed recommender fact against the source dossier; record source references in `review_note`.
2. Complete the existing source publication/signoff workflow for the underlying `Problem_Oil_Map` row so it appears in `public_problem_oils`. The recommender view explicitly requires this source signoff.
3. Approve the matching `guide_concerns` label for questionnaire display and the relevant `oil_guide_mappings` relationship. A mapping can remain hidden from the full browse page and still be used by the recommender only after its review is approved; a mapping marked disabled is never used.
4. Populate the narrow snapshot and set the explicit safety decision. Publish the limited recommendation projection only after review.

Illustrative one-oil SQL template (replace every placeholder with source-verified values; set any unsupported/absent optional field to NULL or an empty array rather than inferring it; do not bulk-approve rows). This example is for an eligible/caution item; excluded items stay hidden and are not published:

```sql
UPDATE oil_encyclopedia.guide_recommendation_reviews
SET review_status = 'approved',
    safety_decision = 'eligible', -- or eligible_with_caution / excluded after review
    display_status = 'published', -- keep hidden for excluded or not-yet-published items
    name_fa = '<verified Persian name>',
    name_en = '<verified English name>',
    scientific_name = '<verified scientific name>',
    oil_kind = '<verified oil kind>',
    texture = '<verified texture>',
    use_face = '<verified source value>',
    use_body = '<verified source value>',
    use_massage = '<verified source value>',
    use_hair_shaft = '<verified source value>',
    use_scalp = '<verified source value>',
    use_traditional = '<verified source value>',
    use_hair_types = '<verified source value>',
    evidence_levels = ARRAY['<verified evidence label>']::text[],
    reviewed_by = '<authorized reviewer>',
    reviewed_at = NOW(),
    review_note = '<source table and record references>'
WHERE oil_id = '<canonical oil ID>'
  AND review_status = 'needs_human_review';
```

For a caution decision, an approved customer-facing safety warning must also exist; otherwise the candidate view keeps that oil ineligible. The `public_problem_oils` signoff is an independent source gate and is not changed by this statement. The detailed `public_oil_profiles` publication workflow also remains independent. None of these statements was run as part of PR #46.
