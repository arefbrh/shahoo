-- Batch 05.02. Do not edit 0002, 0003, or 0004.
-- 0004 backfills coupon_id with a case-insensitive match. If two coupons differ
-- only by letter case, that update can attach either row. This pass undoes an
-- ambiguous link and fills a null id only when exactly one coupon matches.

update orders as o
set coupon_id = null
where o.coupon_code is not null
  and (
    select count(*) from coupons as c
    where upper(c.code) = upper(o.coupon_code)
  ) > 1;

update orders as o
set coupon_id = matched.id
from (
  select upper(code) as code_key, min(id) as id, count(*) as n
  from coupons
  group by upper(code)
) as matched
where o.coupon_id is null
  and o.coupon_code is not null
  and upper(o.coupon_code) = matched.code_key
  and matched.n = 1;
