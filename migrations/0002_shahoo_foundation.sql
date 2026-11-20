-- SHAHOO commerce foundation.
-- Money is integer Iranian rials (IRR). The storefront displays toman = IRR / 10.
-- Do not store prices as floating-point.

create table if not exists customers (
  id text primary key,
  mobile text unique,
  full_name text not null default '',
  email text,
  password_hash text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists customer_addresses (
  id text primary key,
  customer_id text not null references customers (id) on delete cascade,
  label text not null default '',
  province text not null,
  city text not null,
  address_line text not null,
  postal_code text not null default '',
  plaque text not null default '',
  unit text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists customer_addresses_customer_idx on customer_addresses (customer_id);

create table if not exists admin_roles (
  id text primary key,
  key text not null unique,
  name text not null,
  description text not null default ''
);

create table if not exists admin_permissions (
  id text primary key,
  key text not null unique,
  description text not null default ''
);

create table if not exists admin_role_permissions (
  role_id text not null references admin_roles (id) on delete cascade,
  permission_id text not null references admin_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists admin_users (
  id text primary key,
  mobile text unique,
  email text unique,
  full_name text not null,
  password_hash text,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists admin_user_roles (
  admin_user_id text not null references admin_users (id) on delete cascade,
  role_id text not null references admin_roles (id) on delete cascade,
  primary key (admin_user_id, role_id)
);

create table if not exists otp_challenges (
  id text primary key,
  mobile text not null,
  purpose text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists otp_challenges_mobile_idx on otp_challenges (mobile, purpose, created_at desc);

create table if not exists customer_sessions (
  id text primary key,
  customer_id text not null references customers (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists admin_sessions (
  id text primary key,
  admin_user_id text not null references admin_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists media_assets (
  id text primary key,
  folder text not null default 'library',
  filename text not null,
  mime_type text not null,
  byte_size integer not null default 0,
  width integer,
  height integer,
  alt text not null default '',
  storage_key text not null,
  public_url text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists media_assets_folder_idx on media_assets (folder);

create table if not exists product_categories (
  id text primary key,
  slug text not null unique,
  name text not null,
  short_name text not null,
  english_name text not null default '',
  description text not null default '',
  icon_type text not null default 'all',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists products (
  id text primary key,
  category_id text not null references product_categories (id),
  slug text not null unique,
  sku text not null unique,
  name text not null,
  english_name text not null default '',
  subtitle text not null default '',
  homepage_title text not null default '',
  homepage_subtitle text not null default '',
  short_description text not null default '',
  full_description text not null default '',
  origin text not null default '',
  ingredients text not null default '',
  usage_instructions text not null default '',
  storage_instructions text not null default '',
  is_organic boolean not null default false,
  is_best_seller boolean not null default false,
  is_featured boolean not null default false,
  featured_order integer,
  catalog_order integer not null default 0,
  visual_key text not null default '',
  status text not null default 'draft',
  seo_title text not null default '',
  seo_description text not null default '',
  oil_finder jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_status_idx on products (status, catalog_order);

create table if not exists product_variants (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  sku text not null unique,
  label text not null,
  unit_kind text not null default 'custom',
  amount integer,
  price_irr bigint not null,
  compare_at_price_irr bigint,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint product_variants_price_positive check (price_irr > 0)
);
create index if not exists product_variants_product_idx on product_variants (product_id);

create table if not exists product_images (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  media_id text references media_assets (id),
  url text not null default '',
  alt text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists product_specs (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null default 0
);

create table if not exists inventory (
  variant_id text primary key references product_variants (id) on delete cascade,
  on_hand integer not null default 0,
  reserved integer not null default 0,
  low_stock_threshold integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint inventory_on_hand_nonnegative check (on_hand >= 0),
  constraint inventory_reserved_nonnegative check (reserved >= 0)
);

create table if not exists inventory_logs (
  id text primary key,
  variant_id text not null references product_variants (id),
  delta integer not null,
  reason text not null,
  note text not null default '',
  actor_admin_id text references admin_users (id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_logs_variant_idx on inventory_logs (variant_id, created_at desc);

create table if not exists carts (
  id text primary key,
  customer_id text references customers (id) on delete cascade,
  guest_token_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id text primary key,
  cart_id text not null references carts (id) on delete cascade,
  variant_id text not null references product_variants (id),
  quantity integer not null,
  constraint cart_items_quantity_positive check (quantity > 0),
  unique (cart_id, variant_id)
);

create table if not exists coupons (
  id text primary key,
  code text not null unique,
  description text not null default '',
  percent_off integer,
  amount_off_irr bigint,
  min_subtotal_irr bigint not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipping_methods (
  id text primary key,
  key text not null unique,
  title text not null,
  description text not null default '',
  price_irr bigint not null default 0,
  free_over_irr bigint,
  is_active boolean not null default true,
  provider text not null default 'manual',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  public_code text not null unique,
  customer_id text references customers (id),
  status text not null default 'pending',
  full_name text not null,
  mobile text not null,
  province text not null,
  city text not null,
  address_line text not null,
  postal_code text not null default '',
  plaque text not null default '',
  unit text not null default '',
  customer_note text not null default '',
  shipping_method_id text references shipping_methods (id),
  shipping_title text not null default '',
  tracking_code text,
  subtotal_irr bigint not null,
  discount_irr bigint not null default 0,
  shipping_irr bigint not null default 0,
  total_irr bigint not null,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_mobile_idx on orders (mobile);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  variant_id text references product_variants (id),
  product_name text not null,
  variant_label text not null,
  sku text not null,
  quantity integer not null,
  unit_price_irr bigint not null,
  line_total_irr bigint not null
);

create table if not exists order_events (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  status text not null,
  note text not null default '',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders (id),
  provider text not null,
  status text not null,
  amount_irr bigint not null,
  authority text,
  reference_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on payments (order_id);

create table if not exists payment_logs (
  id text primary key,
  payment_id text not null references payments (id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists shipping_logs (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  status text not null,
  tracking_code text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists wishlists (
  id text primary key,
  customer_id text not null unique references customers (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists wishlist_items (
  wishlist_id text not null references wishlists (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table if not exists reviews (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  customer_id text references customers (id),
  author_name text not null,
  rating integer not null,
  body text not null,
  status text not null default 'pending',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5)
);
create index if not exists reviews_product_idx on reviews (product_id, status);

create table if not exists article_categories (
  id text primary key,
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists articles (
  id text primary key,
  category_id text references article_categories (id),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  author_name text not null default '',
  read_minutes integer not null default 3,
  visual_key text not null default '',
  cover_media_id text references media_assets (id),
  status text not null default 'draft',
  seo_title text not null default '',
  seo_description text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists article_products (
  article_id text not null references articles (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  primary key (article_id, product_id)
);

create table if not exists banners (
  id text primary key,
  placement text not null default 'home-hero',
  title text not null,
  subtitle text not null default '',
  body text not null default '',
  cta_label text not null default '',
  cta_href text not null default '',
  desktop_media_id text references media_assets (id),
  mobile_media_id text references media_assets (id),
  visual_key text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists homepage_sections (
  id text primary key,
  section_type text not null,
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',
  background text not null default '',
  template_key text not null default 'default',
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists navigation_menus (
  id text primary key,
  key text not null unique,
  name text not null
);

create table if not exists navigation_items (
  id text primary key,
  menu_id text not null references navigation_menus (id) on delete cascade,
  parent_id text references navigation_items (id) on delete cascade,
  label text not null,
  href text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  open_in_new_tab boolean not null default false
);
create index if not exists navigation_items_menu_idx on navigation_items (menu_id, sort_order);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists site_pages (
  id text primary key,
  slug text not null unique,
  title text not null,
  body text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists sms_templates (
  id text primary key,
  key text not null unique,
  body text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  channel text not null,
  template_key text not null default '',
  recipient text not null,
  body text not null,
  status text not null default 'stored',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_channel_idx on notifications (channel, created_at desc);

create table if not exists audit_logs (
  id text primary key,
  actor_type text not null,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
