-- Batch 02 commerce integrity.
-- Adds the payment currency and an optional link from a ledger refund to the
-- verified payment it reverses. No orders, payments, customers, inventory, or
-- audit rows are deleted. Currency is backfilled to IRR.

alter table payments add column if not exists currency text not null default 'IRR';
alter table payments drop constraint if exists payments_currency_irr;
alter table payments add constraint payments_currency_irr check (currency = 'IRR');

alter table payments add column if not exists refund_of_payment_id text;
alter table payments drop constraint if exists payments_refund_of_payment_id_fkey;
alter table payments
  add constraint payments_refund_of_payment_id_fkey
  foreign key (refund_of_payment_id) references payments (id);
