#!/usr/bin/env bash
# Real multi-connection PostgreSQL race test for media attach / replace / retire.
# SQL-level: each psql process is a separate connection and runs the SAME locking
# statements the app issues (src/server/media/lock.ts, storage.ts, cms/content.ts).
# It does not execute the TypeScript code. Never point it at production or Neon.
#
#   PG_RACE_CONFIRM=disposable PGHOST=... PGPORT=... PGUSER=... scripts/pg-media-race.sh
set -u
[ "${PG_RACE_CONFIRM:-}" = "disposable" ] || { echo "Set PG_RACE_CONFIRM=disposable (local throwaway server only)."; exit 2; }
case "${PGHOST:-}" in *neon*|*vercel*|*amazonaws*|*supabase*) echo "Refusing: PGHOST looks like a hosted database."; exit 2;; esac
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="shahoo_race_$$"
export PGDATABASE="$DB"
ADMIN() { PGDATABASE=postgres psql -qAtX -v ON_ERROR_STOP=1 "$@"; }
Q() { psql -qAtX -v ON_ERROR_STOP=1 "$@"; }
ADMIN -c "create database $DB" || exit 2
trap 'PGDATABASE=postgres psql -qAtX -c "drop database if exists $DB" >/dev/null 2>&1' EXIT
for m in 0002_shahoo_foundation 0003_commerce_cart 0004_batch_0501 0005_batch_0502 0006_completion 0007_media_primary 0008_batch_02; do
  Q -f "$ROOT/migrations/$m.sql" >/dev/null || { echo "migration $m failed"; exit 2; }
done
Q -c "insert into product_categories (id,slug,name,short_name,is_active) values ('c','c','c','c',true);
      insert into products (id,category_id,slug,sku,name,status) values ('p','c','p','S','p','published');
      insert into banners (id,placement,title,cta_label,cta_href) values ('b1','home-hero','t','cta','/');" >/dev/null

FAIL=0
fresh() { # $1 asset id
  Q -c "delete from product_images; update banners set desktop_media_id=null; delete from media_assets;
        insert into media_assets (id,filename,mime_type,storage_key,public_url) values ('$1','f.jpg','image/jpeg','local:f','/m/$1');
        insert into media_assets (id,filename,mime_type,storage_key,public_url) values ('old','o.jpg','image/jpeg','local:o','/m/old');
        insert into product_images (id,product_id,media_id,url,is_primary) values ('img0','p','old','/m/old',true);" >/dev/null
}
retire() { # $1 asset, $2 hold seconds after lock. Mirrors retireMedia: lock -> in-use check -> soft delete.
  Q >/dev/null <<SQL
begin;
select id from media_assets where id='$1' and deleted_at is null for update;
select pg_sleep($2);
select (exists(select 1 from banners where desktop_media_id='$1' or mobile_media_id='$1')
     or exists(select 1 from articles where cover_media_id='$1' and deleted_at is null)
     or exists(select 1 from product_images where media_id='$1')) as used \gset
\if :used
  rollback;
\else
  update media_assets set deleted_at=now() where id='$1';
  commit;
\endif
SQL
}
attach() { # corrected attach: lock live asset, insert only if found
  Q >/dev/null <<SQL
begin;
select count(*)=1 as found from (select id from media_assets where id='$1' and deleted_at is null for update) s \gset
\if :found
  insert into product_images (id,product_id,media_id,url) values ('img-new-$RANDOM$RANDOM','p','$1','/m/$1');
  select pg_sleep($2);
\endif
commit;
SQL
}
replace_() { # corrected replace: lock image row, lock live asset, re-point
  Q >/dev/null <<SQL
begin;
select id from product_images where id='img0' for update;
select count(*)=1 as found from (select id from media_assets where id='$1' and deleted_at is null for update) s \gset
\if :found
  update product_images set media_id='$1', url='/m/$1' where id='img0';
  select pg_sleep($2);
\endif
commit;
SQL
}
banner() {
  Q >/dev/null <<SQL
begin;
select count(*)=1 as found from (select id from media_assets where id='$1' and deleted_at is null for update) s \gset
\if :found
  update banners set desktop_media_id='$1' where id='b1';
  select pg_sleep($2);
\endif
commit;
SQL
}
unlocked_attach() { # the Batch 02 behaviour: plain select, no lock (negative control)
  Q >/dev/null <<SQL
begin;
select count(*)=1 as found from media_assets where id='$1' and deleted_at is null \gset
\if :found
  select pg_sleep($2);
  insert into product_images (id,product_id,media_id,url) values ('img-new-$RANDOM$RANDOM','p','$1','/m/$1');
\endif
commit;
SQL
}
dangling() { Q -c "select (select count(*) from product_images i join media_assets m on m.id=i.media_id where m.deleted_at is not null)
  + (select count(*) from banners b join media_assets m on m.id in (b.desktop_media_id,b.mobile_media_id) where m.deleted_at is not null)"; }
deleted() { Q -c "select deleted_at is not null from media_assets where id='$1'"; }
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 (expected=$2 actual=$3)"; else echo "FAIL  $1 (expected=$2 actual=$3)"; FAIL=1; fi
}

# 1. retire holds the lock first; attach arrives meanwhile and must find no live asset
fresh t1; retire t1 1 & sleep 0.3; attach t1 0; wait
check "retire-first / attach: asset retired" t "$(deleted t1)"; check "retire-first / attach: no dangling reference" 0 "$(dangling)"
# 2. attach holds the lock first; retire arrives meanwhile and must see the reference
fresh t2; attach t2 1 & sleep 0.3; retire t2 0; wait
check "attach-first / retire: asset stays live" f "$(deleted t2)"; check "attach-first / retire: reference exists" 1 "$(Q -c "select count(*) from product_images where media_id='t2'")"
# 3. replace vs retire, both orders
fresh t3; retire t3 1 & sleep 0.3; replace_ t3 0; wait
check "retire-first / replace: asset retired" t "$(deleted t3)"; check "retire-first / replace: no dangling" 0 "$(dangling)"
check "retire-first / replace: image kept old asset" old "$(Q -c "select media_id from product_images where id='img0'")"
fresh t4; replace_ t4 1 & sleep 0.3; retire t4 0; wait
check "replace-first / retire: asset stays live" f "$(deleted t4)"; check "replace-first / retire: image points at it" t4 "$(Q -c "select media_id from product_images where id='img0'")"
# 4. banner vs retire, both orders
fresh t5; retire t5 1 & sleep 0.3; banner t5 0; wait
check "retire-first / banner: no dangling" 0 "$(dangling)"
fresh t6; banner t6 1 & sleep 0.3; retire t6 0; wait
check "banner-first / retire: asset stays live" f "$(deleted t6)"
# 5. replacing old asset while another record shares it: old stays referenced -> retire refuses
fresh t7; Q -c "insert into product_images (id,product_id,media_id,url) values ('img-share','p','old','/m/old')" >/dev/null
replace_ t7 0; retire old 0
check "shared asset survives replacement" f "$(deleted old)"
# 6. negative control: Batch 02 unlocked attach loses the race (proves the race is real)
fresh t8; unlocked_attach t8 1 & sleep 0.3; retire t8 0; wait
echo "INFO  negative control (unlocked attach, old behaviour) dangling references = $(dangling) (>=1 means the race was reproduced)"
# 7. stress: truly simultaneous, 60 rounds each of three pairings, with the corrected statements
BAD=0
for i in $(seq 1 60); do
  fresh s; attach s 0 & retire s 0 & wait; BAD=$((BAD + $(dangling)))
  fresh s; replace_ s 0 & retire s 0 & wait; BAD=$((BAD + $(dangling)))
  fresh s; banner s 0 & retire s 0 & wait; BAD=$((BAD + $(dangling)))
done
check "stress 180 simultaneous rounds: dangling references" 0 "$BAD"
exit $FAIL
