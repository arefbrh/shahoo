-- One primary image per product. Older migrations are not edited.
-- If a race left two primaries, keep the earliest row and demote the rest.

with ranked as (
  select id,
         row_number() over (partition by product_id order by created_at, id) as n
  from product_images
  where is_primary
)
update product_images
set is_primary = false
where id in (select id from ranked where n > 1);

create unique index if not exists product_images_one_primary_idx
  on product_images (product_id)
  where is_primary;
