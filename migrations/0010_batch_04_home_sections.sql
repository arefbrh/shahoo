-- Batch 04 correction: provision only the three approved, database-backed product sections.
-- `section_type` is their stable structural key; existing rows (including custom IDs and
-- administrator edits) are never updated. Missing rows append after existing order.
-- Canonical IDs match the existing demo section IDs, but this migration does not depend on demo seed.
with required_sections (id, section_type, title, subtitle, config, priority) as (
  values
    ('sec-best', 'best_sellers', 'پرفروش‌های شاهو', 'انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.', '{"limit":4,"flags":["best"]}'::jsonb, 1),
    ('sec-new', 'new_arrivals', 'تازه‌های ماه', 'تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.', '{"limit":4,"flags":["newest"]}'::jsonb, 2),
    ('sec-offers', 'special_offers', 'پیشنهادهای ویژه', 'انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.', '{"limit":4,"flags":["offer"]}'::jsonb, 3)
), missing_sections as (
  select required_sections.*
  from required_sections
  where not exists (
    select 1
    from homepage_sections existing
    where existing.section_type = required_sections.section_type
  )
), candidate_ids as (
  select
    missing_sections.*,
    missing_sections.id as provisioned_id,
    0::integer as id_priority
  from missing_sections

  union all

  select
    missing_sections.*,
    'shahoo-home-' || missing_sections.section_type || '-' || candidate_suffix.value::text,
    candidate_suffix.value::integer
  from missing_sections
  cross join lateral generate_series(
    1,
    (select count(*)::integer + 1 from homepage_sections)
  ) as candidate_suffix(value)
), available_ids as (
  select
    candidate_ids.*,
    row_number() over (
      partition by candidate_ids.section_type
      order by candidate_ids.id_priority
    ) as id_rank
  from candidate_ids
  where not exists (
    select 1
    from homepage_sections existing
    where existing.id = candidate_ids.provisioned_id
  )
), sections_to_insert as (
  select *
  from available_ids
  where id_rank = 1
), current_order as (
  select greatest(coalesce(max(sort_order), 0), 0) as last_order
  from homepage_sections
)
insert into homepage_sections (
  id,
  section_type,
  title,
  subtitle,
  body,
  background,
  template_key,
  config,
  sort_order,
  is_active
)
select
  sections_to_insert.provisioned_id,
  sections_to_insert.section_type,
  sections_to_insert.title,
  sections_to_insert.subtitle,
  '',
  '',
  'default',
  sections_to_insert.config,
  (current_order.last_order + row_number() over (order by sections_to_insert.priority))::integer,
  true
from sections_to_insert
cross join current_order;
