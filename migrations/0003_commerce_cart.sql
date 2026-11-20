alter table orders add column if not exists idempotency_key text;
alter table orders add column if not exists buyer_key text not null default '';
alter table orders add column if not exists access_token_hash text;
alter table orders add column if not exists stock_hold_until timestamptz;
alter table orders add constraint orders_idempotency_key_unique unique (idempotency_key);

create index if not exists orders_hold_idx on orders (status, stock_hold_until);
create index if not exists orders_customer_idx on orders (customer_id, created_at desc);

with ranked as (
  select id, row_number() over (partition by customer_id order by updated_at desc, id desc) as rn
  from carts
  where customer_id is not null
)
delete from carts where id in (select id from ranked where rn > 1);

create unique index if not exists carts_customer_unique_idx on carts (customer_id) where customer_id is not null;
