export type NavLink = {
  label: string;
  href: string;
};

export type FooterColumn = {
  title: string;
  links: NavLink[];
};

export type StoreProfile = {
  brandName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
  copyright: string;
};

export type BrandLogos = {
  header: string;
  footer: string;
  headerPng: string;
  footerPng: string;
};

export type StoreLayoutSettings = { stickyHeader: boolean; headerLogoHeight: number; footerLogoHeight: number; footerAlignment: "start" | "center" };

export type ShellData = {
  profile: StoreProfile;
  layout: StoreLayoutSettings;
  logos: BrandLogos;
  promo: string;
  nav: NavLink[];
  footer: FooterColumn[];
};

export type CategoryCard = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  englishName: string;
  description: string;
  iconType: string;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  englishName: string;
  subtitle: string;
  homepageTitle: string;
  homepageSubtitle: string;
  categorySlug: string;
  categoryName: string;
  iconType: string;
  isOrganic: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  featuredOrder: number | null;
  catalogOrder: number;
  priceIrr: number;
  compareAtPriceIrr: number | null;
  inStock: boolean;
  variantId: string;
  variantLabel: string;
  imageUrl: string;
};

export type VariantChoice = {
  id: string;
  sku: string;
  label: string;
  unitKind: string;
  amount: number | null;
  priceIrr: number;
  compareAtPriceIrr: number | null;
  onHand: number;
  isDefault: boolean;
};

export type ProductDetail = ProductCard & {
  shortDescription: string;
  fullDescription: string;
  origin: string;
  ingredients: string;
  usageInstructions: string;
  storageInstructions: string;
  seoTitle: string;
  seoDescription: string;
  specs: Array<{ label: string; text: string }>;
  gallery: Array<{ id: string; url: string; alt: string; isPrimary: boolean }>;
  variants: VariantChoice[];
  oilFinder: { intendedUse: string[]; texture: string; scent: string } | null;
};

export type BannerSlide = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  desktopUrl: string;
  mobileUrl: string;
  imageAlt?: string;
};

export type HomeSection = {
  id: string;
  sectionType: string;
  title: string;
  subtitle: string;
  body: string;
  background: string;
  config: {
    limit?: number;
    flags?: Array<"featured" | "best" | "offer" | "newest">;
    items?: Array<{ title: string; text: string }>;
  };
};

export type ArticleCard = {
  slug: string;
  title: string;
  excerpt: string;
  categoryName: string;
  authorName: string;
  readMinutes: number;
};

export type ArticleDetail = ArticleCard & {
  seoTitle: string;
  seoDescription: string;
  content: string;
  coverUrl: string | null;
  coverAlt: string | null;
  related: ProductCard[];
};

export type SitePage = {
  slug: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  origin: string;
};

export type HomeData = {
  banners: BannerSlide[];
  carousel: { autoPlay: boolean; intervalMs: number };
  sections: HomeSection[];
  categories: CategoryCard[];
  products: ProductCard[];
  articles: ArticleCard[];
  story: { title: string; about: string; philosophy: string };
};

export type CatalogQuery = {
  category: string;
  sort: "popular" | "price-asc" | "price-desc" | "newest" | "rating";
  q: string;
  maxToman: number | null;
  organic: boolean;
  discounted: boolean;
  best: boolean;
  available: boolean;
};

export type FoundationReport = {
  connected: boolean;
  products: number;
  categories: number;
  variants: number;
  sections: number;
  pages: number;
  articles: number;
  lowStock: number;
  orders: number;
  seedVersion: number | null;
};
