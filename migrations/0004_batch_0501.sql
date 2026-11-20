-- Batch 05.01. Do not edit 0002 or 0003.
-- Durable admin login throttle, coupon identity on orders, diagnostics, read permissions.

create table if not exists auth_throttle (
  scope text not null,
  subject_hash text not null,
  failures integer not null default 0,
  locked_until timestamptz,
  last_failure_at timestamptz,
  audits_written integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

create table if not exists ops_diagnostics (
  id text primary key,
  kind text not null,
  entity_type text not null,
  entity_id text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_diagnostics_created_idx on ops_diagnostics (created_at desc);

alter table orders add column if not exists coupon_id text;

update orders as o
set coupon_id = c.id
from coupons as c
where o.coupon_id is null
  and o.coupon_code is not null
  and upper(o.coupon_code) = upper(c.code);

alter table orders drop constraint if exists orders_coupon_id_fkey;

alter table orders
  add constraint orders_coupon_id_fkey
  foreign key (coupon_id) references coupons (id) on delete set null;

create index if not exists orders_coupon_id_idx on orders (coupon_id);

insert into admin_permissions (id, key, description) values
  ('perm-inventory.read', 'inventory.read', 'مشاهده موجودی'),
  ('perm-customers.write', 'customers.write', 'تغییر وضعیت مشتری'),
  ('perm-settings.read', 'settings.read', 'مشاهده تخفیف و ارسال'),
  ('perm-admins.read', 'admins.read', 'مشاهده مدیران')
on conflict (key) do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
join admin_permissions p on p.key in ('inventory.read', 'customers.write', 'settings.read', 'admins.read')
where r.key = 'super_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
join admin_permissions p on p.key = 'inventory.read'
where r.key = 'product_manager'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
join admin_permissions p on p.key = 'settings.read'
where r.key = 'order_manager'
on conflict do nothing;
