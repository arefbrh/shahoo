import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type OilFinder = {
  intendedUse: string[];
  texture: string;
  scent: string;
};

export type SectionConfig = {
  limit?: number;
  flags?: Array<"featured" | "best" | "offer" | "newest">;
  items?: Array<{ title: string; text: string }>;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  mobile: text("mobile").unique(),
  fullName: text("full_name").notNull().default(""),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  gender: text("gender"),
  ageGroup: text("age_group"),
  email: text("email"),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("active"),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  check("customers_gender_check", sql`${table.gender} IS NULL OR ${table.gender} IN ('female', 'male', 'prefer_not_to_say')`),
  check("customers_age_group_check", sql`${table.ageGroup} IS NULL OR ${table.ageGroup} IN ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say')`),
]);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    recipientName: text("recipient_name").notNull().default(""),
    recipientMobile: text("recipient_mobile").notNull().default(""),
    province: text("province").notNull(),
    city: text("city").notNull(),
    addressLine: text("address_line").notNull(),
    postalCode: text("postal_code").notNull().default(""),
    plaque: text("plaque").notNull().default(""),
    unit: text("unit").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("customer_addresses_customer_idx").on(table.customerId),
    uniqueIndex("customer_addresses_one_default_idx")
      .on(table.customerId)
      .where(sql`${table.isDefault} = TRUE AND ${table.deletedAt} IS NULL`),
  ],
);

export const adminRoles = pgTable("admin_roles", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const adminPermissions = pgTable("admin_permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => adminPermissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const adminUsers = pgTable("admin_users", {
  id: text("id").primaryKey(),
  mobile: text("mobile").unique(),
  email: text("email").unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("invited"),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const adminUserRoles = pgTable(
  "admin_user_roles",
  {
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.adminUserId, table.roleId] })],
);

export const otpChallenges = pgTable("otp_challenges", {
  id: text("id").primaryKey(),
  mobile: text("mobile").notNull(),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerSessions = pgTable("customer_sessions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const adminSessions = pgTable("admin_sessions", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const authThrottle = pgTable(
  "auth_throttle",
  {
    scope: text("scope").notNull(),
    subjectHash: text("subject_hash").notNull(),
    failures: integer("failures").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    auditsWritten: integer("audits_written").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.subjectHash] })],
);

export const opsDiagnostics = pgTable("ops_diagnostics", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  folder: text("folder").notNull().default("library"),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt").notNull().default(""),
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const productCategories = pgTable("product_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  englishName: text("english_name").notNull().default(""),
  description: text("description").notNull().default(""),
  iconType: text("icon_type").notNull().default("all"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => productCategories.id),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    englishName: text("english_name").notNull().default(""),
    subtitle: text("subtitle").notNull().default(""),
    homepageTitle: text("homepage_title").notNull().default(""),
    homepageSubtitle: text("homepage_subtitle").notNull().default(""),
    shortDescription: text("short_description").notNull().default(""),
    fullDescription: text("full_description").notNull().default(""),
    origin: text("origin").notNull().default(""),
    ingredients: text("ingredients").notNull().default(""),
    usageInstructions: text("usage_instructions").notNull().default(""),
    storageInstructions: text("storage_instructions").notNull().default(""),
    isOrganic: boolean("is_organic").notNull().default(false),
    isBestSeller: boolean("is_best_seller").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredOrder: integer("featured_order"),
    catalogOrder: integer("catalog_order").notNull().default(0),
    visualKey: text("visual_key").notNull().default(""),
    status: text("status").notNull().default("draft"),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    oilFinder: jsonb("oil_finder").$type<OilFinder | null>(),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("products_category_idx").on(table.categoryId),
    index("products_status_idx").on(table.status, table.catalogOrder),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    label: text("label").notNull(),
    unitKind: text("unit_kind").notNull().default("custom"),
    amount: integer("amount"),
    priceIrr: bigint("price_irr", { mode: "number" }).notNull(),
    compareAtPriceIrr: bigint("compare_at_price_irr", { mode: "number" }),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("active"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("product_variants_product_idx").on(table.productId)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: text("media_id").references(() => mediaAssets.id),
    url: text("url").notNull().default(""),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("product_images_one_primary_idx").on(table.productId).where(sql`${table.isPrimary} = true`)],
);

export const productSpecs = pgTable("product_specs", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  value: text("value").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const inventory = pgTable("inventory", {
  variantId: text("variant_id")
    .primaryKey()
    .references(() => productVariants.id, { onDelete: "cascade" }),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryLogs = pgTable("inventory_logs", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  note: text("note").notNull().default(""),
  actorAdminId: text("actor_admin_id").references(() => adminUsers.id),
  onHandBefore: integer("on_hand_before"),
  onHandAfter: integer("on_hand_after"),
  reservedBefore: integer("reserved_before"),
  reservedAfter: integer("reserved_after"),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carts = pgTable(
  "carts",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    guestTokenHash: text("guest_token_hash").unique(),
    ...timestamps,
  },
  (table) => [uniqueIndex("carts_customer_unique_idx").on(table.customerId).where(sql`${table.customerId} is not null`)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [uniqueIndex("cart_items_cart_variant_idx").on(table.cartId, table.variantId)],
);

export const coupons = pgTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  percentOff: integer("percent_off"),
  amountOffIrr: bigint("amount_off_irr", { mode: "number" }),
  minSubtotalIrr: bigint("min_subtotal_irr", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  ...timestamps,
});

export const shippingMethods = pgTable("shipping_methods", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  priceIrr: bigint("price_irr", { mode: "number" }).notNull().default(0),
  freeOverIrr: bigint("free_over_irr", { mode: "number" }),
  isActive: boolean("is_active").notNull().default(true),
  provider: text("provider").notNull().default("manual"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  publicCode: text("public_code").notNull().unique(),
  customerId: text("customer_id").references(() => customers.id),
  status: text("status").notNull().default("pending"),
  fullName: text("full_name").notNull(),
  mobile: text("mobile").notNull(),
  province: text("province").notNull(),
  city: text("city").notNull(),
  addressLine: text("address_line").notNull(),
  postalCode: text("postal_code").notNull().default(""),
  plaque: text("plaque").notNull().default(""),
  unit: text("unit").notNull().default(""),
  customerNote: text("customer_note").notNull().default(""),
  shippingMethodId: text("shipping_method_id").references(() => shippingMethods.id),
  shippingTitle: text("shipping_title").notNull().default(""),
  trackingCode: text("tracking_code"),
  subtotalIrr: bigint("subtotal_irr", { mode: "number" }).notNull(),
  discountIrr: bigint("discount_irr", { mode: "number" }).notNull().default(0),
  shippingIrr: bigint("shipping_irr", { mode: "number" }).notNull().default(0),
  totalIrr: bigint("total_irr", { mode: "number" }).notNull(),
  couponCode: text("coupon_code"),
  couponId: text("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").unique(),
  buyerKey: text("buyer_key").notNull().default(""),
  accessTokenHash: text("access_token_hash"),
  stockHoldUntil: timestamp("stock_hold_until", { withTimezone: true }),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  addressId: text("address_id").references(() => customerAddresses.id, { onDelete: "set null" }),
  stockState: text("stock_state").notNull().default("held"),
  ...timestamps,
});

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: text("variant_id").references(() => productVariants.id),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceIrr: bigint("unit_price_irr", { mode: "number" }).notNull(),
  lineTotalIrr: bigint("line_total_irr", { mode: "number" }).notNull(),
});

export const orderEvents = pgTable("order_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  actor: text("actor").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  amountIrr: bigint("amount_irr", { mode: "number" }).notNull(),
  authority: text("authority"),
  referenceId: text("reference_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  currency: text("currency").notNull().default("IRR"),
  refundOfPaymentId: text("refund_of_payment_id"),
  ...timestamps,
});

export const paymentAttempts = pgTable("payment_attempts", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  amountIrr: bigint("amount_irr", { mode: "number" }).notNull(),
  providerAmountToman: bigint("provider_amount_toman", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("IRR"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  providerRequestRef: text("provider_request_ref"),
  providerPaymentCode: text("provider_payment_code").unique(),
  verificationPaymentRefId: bigint("verification_payment_ref_id", { mode: "number" }),
  providerReferenceId: text("provider_reference_id").unique(),
  state: text("state").notNull().default("initiated"),
  verifiedAmountIrr: bigint("verified_amount_irr", { mode: "number" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  settlementError: text("settlement_error"),
  reconciliationRequired: boolean("reconciliation_required").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("payment_attempts_order_idx").on(table.orderId),
  index("payment_attempts_state_idx").on(table.state),
  uniqueIndex("payment_attempts_one_active_order_idx").on(table.orderId).where(sql`state IN ('initiated', 'redirect_pending', 'provider_outcome_unknown', 'provider_verified', 'local_settlement_pending', 'settling', 'manual_review')`),
]);

export const paymentLogs = pgTable("payment_logs", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shippingLogs = pgTable("shipping_logs", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  trackingCode: text("tracking_code"),
  note: text("note").notNull().default(""),
  carrier: text("carrier").notNull().default(""),
  handedOffAt: timestamp("handed_off_at", { withTimezone: true }),
  actor: text("actor").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wishlists = pgTable("wishlists", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .unique()
    .references(() => customers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    wishlistId: text("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.wishlistId, table.productId] })],
);

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  isSample: boolean("is_sample").notNull().default(false),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleCategories = pgTable("article_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const articles = pgTable("articles", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").references(() => articleCategories.id),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  readMinutes: integer("read_minutes").notNull().default(3),
  visualKey: text("visual_key").notNull().default(""),
  coverMediaId: text("cover_media_id").references(() => mediaAssets.id),
  status: text("status").notNull().default("draft"),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const articleProducts = pgTable(
  "article_products",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.productId] })],
);

export const banners = pgTable("banners", {
  id: text("id").primaryKey(),
  placement: text("placement").notNull().default("home-hero"),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  body: text("body").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default(""),
  ctaHref: text("cta_href").notNull().default(""),
  desktopMediaId: text("desktop_media_id").references(() => mediaAssets.id),
  mobileMediaId: text("mobile_media_id").references(() => mediaAssets.id),
  visualKey: text("visual_key").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...timestamps,
});

export const homepageSections = pgTable("homepage_sections", {
  id: text("id").primaryKey(),
  sectionType: text("section_type").notNull(),
  title: text("title").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  body: text("body").notNull().default(""),
  background: text("background").notNull().default(""),
  templateKey: text("template_key").notNull().default("default"),
  config: jsonb("config").$type<SectionConfig>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const navigationMenus = pgTable("navigation_menus", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
});

export const navigationItems = pgTable("navigation_items", {
  id: text("id").primaryKey(),
  menuId: text("menu_id")
    .notNull()
    .references(() => navigationMenus.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  label: text("label").notNull(),
  href: text("href").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  openInNewTab: boolean("open_in_new_tab").notNull().default(false),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("content_revisions_entity_type_check", sql`${table.entityType} IN ('page', 'article')`),
    uniqueIndex("content_revisions_entity_version_idx").on(table.entityType, table.entityId, table.version),
    index("content_revisions_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
  ],
);

export const sitePages = pgTable("site_pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smsTemplates = pgTable("sms_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  body: text("body").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  templateKey: text("template_key").notNull().default(""),
  recipient: text("recipient").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("stored"),
  error: text("error"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  eventKey: text("event_key").notNull().default(""),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpRequestBuckets = pgTable(
  "otp_request_buckets",
  {
    scope: text("scope").notNull(),
    subjectHash: text("subject_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.scope, table.subjectHash] })],
);

export const supportTickets = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  publicCode: text("public_code").notNull().unique(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  ...timestamps,
});

export const supportMessages = pgTable("support_messages", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const returnRequests = pgTable("return_requests", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  refundKind: text("refund_kind").notNull().default("full"),
  amountIrr: bigint("amount_irr", { mode: "number" }).notNull().default(0),
  note: text("note").notNull().default(""),
  ...timestamps,
});

export const returnEvents = pgTable("return_events", {
  id: text("id").primaryKey(),
  returnId: text("return_id")
    .notNull()
    .references(() => returnRequests.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  actor: text("actor").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
