-- Completion tables. Earlier migrations are not edited.
-- Money stays integer rials. No sample reviews, orders, or credentials.

alter table orders add column if not exists payment_status text not null default 'unpaid';
alter table orders add column if not exists address_id text references customer_addresses (id) on delete set null;
alter table orders add column if not exists stock_state text not null default 'held';

update orders
set stock_state = 'released'
where status in ('cancelled', 'expired')
  and stock_state = 'held';

alter table shipping_logs add column if not exists carrier text not null default '';
alter table shipping_logs add column if not exists handed_off_at timestamptz;
alter table shipping_logs add column if not exists actor text not null default 'system';

alter table reviews add column if not exists verified_purchase boolean not null default false;
alter table reviews add column if not exists updated_at timestamptz not null default now();

create unique index if not exists reviews_live_customer_product
  on reviews (customer_id, product_id)
  where customer_id is not null and status in ('pending', 'approved');

alter table notifications add column if not exists customer_id text references customers (id) on delete cascade;
alter table notifications add column if not exists order_id text references orders (id) on delete cascade;
alter table notifications add column if not exists event_key text not null default '';
alter table notifications add column if not exists read_at timestamptz;

create table if not exists otp_request_buckets (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  hits integer not null default 0,
  last_request_at timestamptz,
  primary key (scope, subject_hash)
);

create table if not exists support_tickets (
  id text primary key,
  public_code text not null unique,
  customer_id text not null references customers (id) on delete cascade,
  category text not null,
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_customer_idx on support_tickets (customer_id, updated_at desc);

create table if not exists support_messages (
  id text primary key,
  ticket_id text not null references support_tickets (id) on delete cascade,
  author_type text not null,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);

create table if not exists return_requests (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  customer_id text references customers (id) on delete set null,
  reason text not null,
  status text not null default 'requested',
  refund_kind text not null default 'full',
  amount_irr bigint not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists return_requests_order_idx on return_requests (order_id, created_at desc);

create table if not exists return_events (
  id text primary key,
  return_id text not null references return_requests (id) on delete cascade,
  status text not null,
  note text not null default '',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

insert into admin_permissions (id, key, description)
values ('perm-support.write', 'support.write', 'پاسخ و بستن درخواست پشتیبانی')
on conflict (key) do nothing;

insert into admin_role_permissions (role_id, permission_id)
select role.id, 'perm-support.write'
from admin_roles as role
where role.key in ('super_admin', 'order_manager', 'customer_support')
on conflict do nothing;
