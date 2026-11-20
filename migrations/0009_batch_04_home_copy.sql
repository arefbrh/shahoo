-- Batch 04: update only known, unchanged demo-seed copy. No records are inserted
-- or deleted; active state, selection, ordering and other CMS fields are untouched.
-- A section saved in the CMS is left alone even if its copy still matches the seed.
-- Unlogged edits equal to old seed values cannot be distinguished from seed values.
update homepage_sections
set subtitle = 'انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.', updated_at = now()
where id = 'sec-best' and section_type = 'best_sellers'
  and subtitle = 'آنچه بیشتر انتخاب شده است'
  and not exists (select 1 from audit_logs where action = 'content.section_updated' and entity_type = 'homepage_section' and entity_id = homepage_sections.id);

update homepage_sections
set title = 'تازه‌های ماه', updated_at = now()
where id = 'sec-new' and section_type = 'new_arrivals'
  and title = 'تازه‌های کاتالوگ'
  and not exists (select 1 from audit_logs where action = 'content.section_updated' and entity_type = 'homepage_section' and entity_id = homepage_sections.id);

update homepage_sections
set subtitle = 'تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.', updated_at = now()
where id = 'sec-new' and section_type = 'new_arrivals'
  and subtitle = 'بسته‌بندی‌ها و ترکیب‌های تازه‌تر'
  and not exists (select 1 from audit_logs where action = 'content.section_updated' and entity_type = 'homepage_section' and entity_id = homepage_sections.id);

update homepage_sections
set subtitle = 'انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.', updated_at = now()
where id = 'sec-offers' and section_type = 'special_offers'
  and subtitle = 'فقط جایی که قیمت قبلی واقعی ثبت شده'
  and not exists (select 1 from audit_logs where action = 'content.section_updated' and entity_type = 'homepage_section' and entity_id = homepage_sections.id);
