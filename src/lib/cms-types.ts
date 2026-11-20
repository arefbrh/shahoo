export type CmsResult = { ok: true } | { ok: false; message: string };

export type SectionFlag = "featured" | "best" | "offer" | "newest";

export type SectionConfigDraft = {
  limit?: number;
  flags?: SectionFlag[];
  items?: Array<{ title: string; text: string }>;
};

export type CmsSection = {
  id: string;
  sectionType: string;
  title: string;
  subtitle: string;
  body: string;
  isActive: boolean;
  sortOrder: number;
  config: SectionConfigDraft;
};

export type CmsBanner = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  sortOrder: number;
  startsOn: string;
  endsOn: string;
  desktopMediaId: string | null;
  mobileMediaId: string | null;
};

export type CmsNavItem = {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
  sortOrder: number;
};

export type CmsMenu = {
  key: string;
  name: string;
  items: CmsNavItem[];
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

export type CmsArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  authorName: string;
  readMinutes: number;
  status: "draft" | "published";
  categoryId: string;
  coverMediaId: string | null;
  relatedProductIds: string[];
};

export type CmsMedia = {
  id: string;
  filename: string;
  alt: string;
  publicUrl: string;
  mimeType: string;
  official: boolean;
};

export type CmsDesk = {
  uploadEnabled: false;
  brandName: string;
  tagline: string;
  copyright: string;
  logos: { header: string; footer: string };
  storyTitle: string;
  storyAbout: string;
  storyPhilosophy: string;
  promo: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
  sections: CmsSection[];
  banners: CmsBanner[];
  menus: CmsMenu[];
  pages: CmsPage[];
  articles: CmsArticle[];
  articleCategories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  media: CmsMedia[];
};

export type SectionDraft = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  isActive: boolean;
  config: SectionConfigDraft;
};

export type BannerDraft = {
  id?: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  startsOn: string;
  endsOn: string;
  desktopMediaId?: string | null;
  mobileMediaId?: string | null;
};

export type NavDraft = {
  id?: string;
  menuKey: string;
  label: string;
  href: string;
  isActive: boolean;
};

export type PageDraft = {
  id?: string;
  slug: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

export type ArticleDraft = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  authorName: string;
  readMinutes: number;
  status: "draft" | "published";
  categoryId: string;
  coverMediaId: string | null;
  relatedProductIds: string[];
};

export type CopyDraft = {
  storyTitle: string;
  storyAbout: string;
  storyPhilosophy: string;
  promo: string;
};

export type ProfileDraft = {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
};

export type BrandSettingsDraft = {
  brandName: string;
  tagline: string;
  copyright: string;
  headerLogo: string;
  footerLogo: string;
};
