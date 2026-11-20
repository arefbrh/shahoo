export type AdminCategory = {
  id: string;
  name: string;
  englishName: string;
  shortName: string;
  slug: string;
  description: string;
  iconType: string;
  isActive: boolean;
  sortOrder: number;
};

export type AdminVariant = {
  id: string;
  sku: string;
  label: string;
  unitKind: string;
  amount: number | null;
  priceToman: number;
  compareAtToman: number | null;
  isDefault: boolean;
  status: string;
  onHand: number;
  reserved: number;
  sellable: number;
};

export type AdminGalleryImage = {
  id: string;
  mediaId: string | null;
  url: string;
  alt: string;
  isPrimary: boolean;
};

export type AdminMedia = {
  id: string;
  alt: string;
  publicUrl: string;
  mimeType: string;
};

export type AdminProduct = {
  id: string;
  categoryId: string;
  name: string;
  englishName: string;
  subtitle: string;
  homepageTitle: string;
  homepageSubtitle: string;
  slug: string;
  sku: string;
  status: string;
  shortDescription: string;
  fullDescription: string;
  origin: string;
  ingredients: string;
  usageInstructions: string;
  storageInstructions: string;
  seoTitle: string;
  seoDescription: string;
  oilFinder: { intendedUse: string[]; texture: string; scent: string } | null;
  specs: Array<{ label: string; value: string }>;
  isOrganic: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  imageUrl: string;
  gallery: AdminGalleryImage[];
  variants: AdminVariant[];
};

export type AdminCatalog = {
  categories: AdminCategory[];
  products: AdminProduct[];
  media: AdminMedia[];
};

export type CatalogResult = { ok: true } | { ok: false; message: string };
