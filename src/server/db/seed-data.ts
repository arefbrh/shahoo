import type { OilFinder } from "./schema";
import { tomanToIrr } from "@/lib/money";

const irr = tomanToIrr;

export type SeedVariant = {
  id: string;
  sku: string;
  label: string;
  unitKind: "volume" | "weight";
  amount: number;
  toman: number;
  compareToman?: number;
  stock: number;
  isDefault?: boolean;
};

export type SeedProduct = {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  englishName: string;
  subtitle: string;
  homepageTitle: string;
  homepageSubtitle: string;
  shortDescription: string;
  fullDescription: string;
  origin: string;
  ingredients: string;
  usageInstructions: string;
  storageInstructions: string;
  isOrganic: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  featuredOrder?: number;
  catalogOrder: number;
  visualKey: string;
  specs: Array<{ label: string; value: string }>;
  variants: SeedVariant[];
  oilFinder?: OilFinder;
};

export const seedCategories = [
  {
    id: "oils",
    slug: "oils",
    name: "روغن‌های گیاهی",
    shortName: "روغن‌های گیاهی",
    englishName: "Herbal Oils",
    iconType: "oils",
    sortOrder: 1,
    description: "روغن‌های خالص استخراج‌شده به روش پرس سرد از دانه‌های منتخب ایرانی",
  },
  {
    id: "butters",
    slug: "butters",
    name: "کره مغزیجات",
    shortName: "کره و مشتقات",
    englishName: "Nut Butters",
    iconType: "butters",
    sortOrder: 2,
    description: "کره‌های طبیعی بدون شکر افزوده، نمک یا نگه‌دارنده صنعتی",
  },
  {
    id: "nuts",
    slug: "nuts",
    name: "مغزیجات و خشکبار",
    shortName: "مغزیجات و خشکبار",
    englishName: "Nuts & Dried Fruits",
    iconType: "nuts",
    sortOrder: 3,
    description: "مغزهای دست‌چین و تازه از باغات و مناطق کوهستانی",
  },
  {
    id: "herbs",
    slug: "herbs",
    name: "گیاهان دارویی",
    shortName: "گیاهان دارویی",
    englishName: "Medicinal Plants",
    iconType: "herbs",
    sortOrder: 4,
    description: "دمنوش‌ها، بذرها و گیاهان معطر ایرانی با عطر طبیعی",
  },
] as const;

const oilDefaults = {
  categoryId: "oils",
  homepageSubtitle: "پرس سرد",
  subtitle: "پرس سرد",
  isOrganic: true,
  ingredients: "۱۰۰٪ روغن خالص گیاهی بدون افزودنی.",
  usageInstructions: "طبق نوع مصرف خوراکی یا موضعی، به مقدار کم استفاده شود.",
  storageInstructions: "در جای خشک، خنک و دور از نور مستقیم نگهداری شود.",
  specs: [{ label: "روش استخراج", value: "پرس سرد" }],
};

export const seedProducts: SeedProduct[] = [
  {
    ...oilDefaults,
    id: "prod-black-seed-oil",
    sku: "SH-BSO",
    name: "روغن سیاهدانه شاهو",
    homepageTitle: "روغن سیاهدانه",
    englishName: "SHAHOO Pure Black Seed Oil",
    shortDescription:
      "روغن سیاهدانه شاهو از دانه‌های مرغوب، مناسب مراقبت پوست و مو. جایگزین توصیه پزشکی نیست.",
    fullDescription:
      "روغن سیاهدانه شاهو از دانه‌های بوجاری‌شده و با پرس سرد در دمای کنترل‌شده استخراج می‌شود. این محصول بدون حلال شیمیایی است و عطر طبیعی دانه را حفظ می‌کند.",
    origin: "مزارع سیاهدانه استان اصفهان و کرمان",
    usageInstructions:
      "چند قطره را روی پوست تمیز یا ساقه مو ماساژ دهید. پیش از مصرف گسترده، روی بخش کوچکی از پوست تست حساسیت انجام شود.",
    ingredients: "۱۰۰٪ روغن خالص سیاهدانه ایرانی بدون حلال شیمیایی یا نگه‌دارنده.",
    isBestSeller: true,
    isFeatured: true,
    featuredOrder: 2,
    catalogOrder: 7,
    visualKey: "black-seed-bottle",
    specs: [
      { label: "روش استخراج", value: "پرس سرد در دمای کنترل‌شده" },
      { label: "بسته‌بندی", value: "بطری شیشه‌ای تیره ضد نور" },
      { label: "ترکیبات", value: "۱۰۰٪ روغن خالص دانه سیاهدانه" },
      { label: "موارد مصرف", value: "مراقبت پوست و مو، ماساژ موضعی" },
    ],
    variants: [
      { id: "v-bso-100", sku: "SH-BSO-100", label: "۱۰۰ میلی‌لیتر", unitKind: "volume", amount: 100, toman: 1_450_000, stock: 24 },
      { id: "v-bso-250", sku: "SH-BSO-250", label: "۲۵۰ میلی‌لیتر", unitKind: "volume", amount: 250, toman: 2_890_000, compareToman: 3_120_000, stock: 18, isDefault: true },
      { id: "v-bso-500", sku: "SH-BSO-500", label: "۵۰۰ میلی‌لیتر", unitKind: "volume", amount: 500, toman: 5_250_000, stock: 9 },
    ],
    oilFinder: { intendedUse: ["skin", "hair", "general"], texture: "rich", scent: "herbal" },
  },
  {
    ...oilDefaults,
    id: "prod-sesame-oil",
    sku: "SH-SES",
    name: "روغن کنجد شاهو",
    homepageTitle: "روغن کنجد شاهو",
    englishName: "SHAHOO Cold-Pressed Sesame Oil",
    subtitle: "فرابکر و خالص",
    homepageSubtitle: "فرابکر و خالص",
    shortDescription: "روغن کنجد بکر از کنجد سفید بوجاری‌شده، مناسب سالاد و پخت ملایم.",
    fullDescription:
      "روغن کنجد شاهو از کنجد تازه و بدون تصفیه صنعتی تولید شده است. عطر ملایم آن برای پخت‌وپز با حرارت ملایم و سس سالاد مناسب است.",
    origin: "کنجد سفید بوجاری‌شده استان فارس و خوزستان",
    usageInstructions: "به سالاد اضافه شود یا در پخت ملایم استفاده شود. برای سرخ‌کردن عمیق توصیه نمی‌شود.",
    ingredients: "۱۰۰٪ روغن دانه کنجد سفید بوجاری‌شده.",
    isBestSeller: true,
    isFeatured: false,
    catalogOrder: 1,
    visualKey: "sesame-oil",
    specs: [
      { label: "روش استخراج", value: "پرس سرد اول" },
      { label: "نوع مصرف", value: "خوراکی با حرارت ملایم و سالاد" },
    ],
    variants: [
      { id: "v-ses-250", sku: "SH-SES-250", label: "۲۵۰ میلی‌لیتر", unitKind: "volume", amount: 250, toman: 1_990_000, stock: 18, isDefault: true },
      { id: "v-ses-500", sku: "SH-SES-500", label: "۵۰۰ میلی‌لیتر", unitKind: "volume", amount: 500, toman: 3_681_500, stock: 8 },
    ],
    oilFinder: { intendedUse: ["cooking", "skin", "general"], texture: "light", scent: "mild" },
  },
  {
    id: "prod-almond-butter",
    categoryId: "butters",
    sku: "SH-ALB",
    name: "کره بادام خانگی",
    englishName: "SHAHOO Artisanal Almond Butter",
    subtitle: "بدون افزودنی",
    homepageTitle: "کره بادام",
    homepageSubtitle: "بدون افزودنی",
    shortDescription: "کره بادام خالص از بادام بوداده ملایم، بدون شکر، نمک یا روغن اضافه.",
    fullDescription:
      "کره بادام شاهو فقط از آسیاب مغز بادام درجه یک ایرانی تولید می‌شود. قند مصنوعی، روغن پالم یا امولسیفایر در آن به کار نرفته است.",
    origin: "بادام درختی باغات استان یزد و آذربایجان شرقی",
    ingredients: "۱۰۰٪ مغز بادام درختی.",
    usageInstructions: "پیش از مصرف هم بزنید. لایه روغن طبیعی روی سطح نشانه خلوص است.",
    storageInstructions: "در جای خشک و خنک و پس از باز شدن در یخچال نگهداری شود.",
    isOrganic: true,
    isBestSeller: true,
    isFeatured: true,
    featuredOrder: 4,
    catalogOrder: 2,
    visualKey: "almond-butter",
    specs: [
      { label: "ترکیبات", value: "۱۰۰٪ مغز بادام درختی ایرانی" },
      { label: "شکر و نمک افزوده", value: "ندارد" },
    ],
    variants: [
      { id: "v-alb-300", sku: "SH-ALB-300", label: "۳۰۰ گرم", unitKind: "weight", amount: 300, toman: 1_200_000, stock: 25, isDefault: true },
      { id: "v-alb-500", sku: "SH-ALB-500", label: "۵۰۰ گرم", unitKind: "weight", amount: 500, toman: 1_890_000, stock: 12 },
    ],
  },
  {
    id: "prod-black-seeds",
    categoryId: "herbs",
    sku: "SH-BSD",
    name: "مغز سیاهدانه ممتاز",
    englishName: "SHAHOO Premium Black Seeds",
    subtitle: "طبیعی و خالص",
    homepageTitle: "سیاهدانه ممتاز",
    homepageSubtitle: "طبیعی و خالص",
    shortDescription: "دانه سیاهدانه ممتاز ایرانی، بوجاری‌شده و بدون گردوغبار.",
    fullDescription: "سیاهدانه ممتاز شاهو از مزارع منتخب برداشت و پس از بوجاری دقیق بسته‌بندی شده است.",
    origin: "مزارع سیاهدانه مناطق خشک مرکزی ایران",
    ingredients: "۱۰۰٪ دانه سیاهدانه خالص.",
    usageInstructions: "همراه با عسل یا در وعده صبحانه. مقدار مصرف را با متخصص تغذیه هماهنگ کنید.",
    storageInstructions: "در ظرف دربسته و دور از نور مستقیم نگهداری شود.",
    isOrganic: true,
    isBestSeller: false,
    isFeatured: true,
    featuredOrder: 3,
    catalogOrder: 3,
    visualKey: "black-seeds",
    specs: [{ label: "خلوص بوجاری", value: "بدون ناخالصی قابل مشاهده" }],
    variants: [
      { id: "v-bsd-250", sku: "SH-BSD-250", label: "۲۵۰ گرم", unitKind: "weight", amount: 250, toman: 690_000, stock: 30 },
      { id: "v-bsd-500", sku: "SH-BSD-500", label: "۵۰۰ گرم", unitKind: "weight", amount: 500, toman: 1_290_000, stock: 18, isDefault: true },
    ],
  },
  {
    id: "prod-walnuts",
    categoryId: "nuts",
    sku: "SH-WAL",
    name: "مغز گردو درجه یک",
    englishName: "SHAHOO Premium Walnut Kernels",
    subtitle: "دست‌چین کوهستان",
    homepageTitle: "مغز گردو درجه یک",
    homepageSubtitle: "دست‌چین کوهستان",
    shortDescription: "مغز گردوی تازه و دست‌چین باغات کوهستانی.",
    fullDescription: "مغز گردوی شاهو از برداشت تازه باغات کوهستانی تهیه شده و بدون فرآوری شیمیایی بسته‌بندی می‌شود.",
    origin: "باغات کوهستانی غرب ایران، منطقه اورامانات",
    ingredients: "۱۰۰٪ مغز گردوی طبیعی.",
    usageInstructions: "مناسب مصرف روزانه در صبحانه و میان‌وعده.",
    storageInstructions: "در جای خنک و خشک؛ برای نگهداری طولانی در فریزر.",
    isOrganic: true,
    isBestSeller: true,
    isFeatured: false,
    catalogOrder: 4,
    visualKey: "walnuts",
    specs: [{ label: "منطقه برداشت", value: "باغات کوهستانی غرب ایران" }],
    variants: [
      { id: "v-wal-250", sku: "SH-WAL-250", label: "۲۵۰ گرم", unitKind: "weight", amount: 250, toman: 790_000, stock: 20 },
      { id: "v-wal-500", sku: "SH-WAL-500", label: "۵۰۰ گرم", unitKind: "weight", amount: 500, toman: 1_490_000, compareToman: 1_650_000, stock: 16, isDefault: true },
    ],
  },
  {
    id: "prod-raw-almonds",
    categoryId: "nuts",
    sku: "SH-ALM",
    name: "مغز بادام خام",
    englishName: "SHAHOO Raw Organic Almonds",
    subtitle: "با کیفیت ممتاز",
    homepageTitle: "مغز بادام خام",
    homepageSubtitle: "با کیفیت ممتاز",
    shortDescription: "مغز بادام درختی خام و شیرین، سورت‌شده.",
    fullDescription: "مغز بادام خام شاهو از ارقام شیرین ایرانی انتخاب شده تا سادگی مغز حفظ شود.",
    origin: "باغات بادام استان چهارمحال و بختیاری",
    ingredients: "۱۰۰٪ مغز بادام شیرین خام.",
    usageInstructions: "مناسب مصرف مستقیم و تهیه شیر بادام خانگی.",
    storageInstructions: "در محیط خشک و خنک نگهداری شود.",
    isOrganic: true,
    isBestSeller: true,
    isFeatured: true,
    featuredOrder: 1,
    catalogOrder: 5,
    visualKey: "almonds",
    specs: [{ label: "نوع محصول", value: "مغز بادام درختی خام" }],
    variants: [
      { id: "v-alm-500", sku: "SH-ALM-500", label: "۵۰۰ گرم", unitKind: "weight", amount: 500, toman: 1_300_000, stock: 28, isDefault: true },
      { id: "v-alm-1000", sku: "SH-ALM-1000", label: "۱۰۰۰ گرم", unitKind: "weight", amount: 1000, toman: 2_550_000, stock: 14 },
    ],
  },
  {
    id: "prod-calming-herbal-tea",
    categoryId: "herbs",
    sku: "SH-TEA",
    name: "دمنوش گیاهی آرامش‌بخش",
    englishName: "SHAHOO Calming Herbal Blend",
    subtitle: "طبیعی و خالص",
    homepageTitle: "دمنوش گیاهی آرامش‌بخش",
    homepageSubtitle: "طبیعی و خالص",
    shortDescription: "ترکیب گل گاوزبان، بهارنارنج، بادرنجبویه و بابونه.",
    fullDescription:
      "دمنوش شاهو ترکیبی از گیاهان معطر ایرانی است. این صفحه اطلاعات مصرف سنتی را بازگو می‌کند و جایگزین توصیه پزشکی نیست.",
    origin: "گیاهان معطر کوهستان‌های البرز و زاگرس",
    ingredients: "برگ بادرنجبویه، غنچه بهارنارنج، گل بابونه، گل گاوزبان.",
    usageInstructions: "یک قاشق غذاخوری را ۸ تا ۱۰ دقیقه با آب حدود ۸۵ درجه دم کنید.",
    storageInstructions: "در ظرف دربسته و دور از رطوبت نگهداری شود.",
    isOrganic: true,
    isBestSeller: true,
    isFeatured: false,
    catalogOrder: 6,
    visualKey: "herbal-tea",
    specs: [{ label: "ترکیبات گیاهی", value: "بهارنارنج، بادرنجبویه، بابونه، گل گاوزبان" }],
    variants: [
      { id: "v-tea-120", sku: "SH-TEA-120", label: "۱۲۰ گرم", unitKind: "weight", amount: 120, toman: 990_000, stock: 35, isDefault: true },
      { id: "v-tea-250", sku: "SH-TEA-250", label: "۲۵۰ گرم", unitKind: "weight", amount: 250, toman: 1_790_000, stock: 20 },
    ],
  },
  {
    ...oilDefaults,
    id: "prod-olive-oil",
    sku: "SH-OLV",
    name: "روغن زیتون فرابکر",
    englishName: "SHAHOO Extra Virgin Olive Oil",
    subtitle: "فرابکر، برداشت تازه",
    homepageTitle: "روغن زیتون فرابکر",
    homepageSubtitle: "فرابکر",
    shortDescription: "روغن زیتون فرابکر از زیتون سبز دست‌چین، مناسب سالاد و پخت ملایم.",
    fullDescription: "روغن زیتون فرابکر شاهو در دمای پایین استخراج می‌شود تا طعم میوه‌ای زیتون باقی بماند.",
    origin: "باغات زیتون رودبار و طارم",
    isBestSeller: false,
    isFeatured: false,
    catalogOrder: 8,
    visualKey: "olive-oil",
    variants: [
      { id: "v-olv-250", sku: "SH-OLV-250", label: "۲۵۰ میلی‌لیتر", unitKind: "volume", amount: 250, toman: 2_450_000, stock: 18, isDefault: true },
      { id: "v-olv-500", sku: "SH-OLV-500", label: "۵۰۰ میلی‌لیتر", unitKind: "volume", amount: 500, toman: 4_532_500, stock: 8 },
    ],
    oilFinder: { intendedUse: ["cooking", "skin", "general"], texture: "light", scent: "mild" },
  },
  {
    id: "prod-pistachio-butter",
    categoryId: "butters",
    sku: "SH-PIB",
    name: "کره پسته خالص",
    englishName: "SHAHOO Pure Pistachio Butter",
    subtitle: "بدون شکر و روغن اضافه",
    homepageTitle: "کره پسته",
    homepageSubtitle: "بدون شکر",
    shortDescription: "کره پسته فقط از مغز پسته بوداده ملایم، بدون شکر و پایدارکننده.",
    fullDescription: "رنگ سبز و بافت خامه‌ای این کره از آسیاب آرام مغز پسته به‌دست می‌آید. جدا شدن روغن روی سطح طبیعی است.",
    origin: "پسته اکبری باغات رفسنجان",
    ingredients: "۱۰۰٪ مغز پسته.",
    usageInstructions: "هم بزنید و با ماست، نان یا اسموتی مصرف کنید.",
    storageInstructions: "پس از باز شدن در یخچال نگهداری شود.",
    isOrganic: true,
    isBestSeller: false,
    isFeatured: false,
    catalogOrder: 9,
    visualKey: "pistachio-butter",
    specs: [{ label: "افزودنی", value: "فاقد شکر، نمک و روغن پالم" }],
    variants: [
      { id: "v-pib-250", sku: "SH-PIB-250", label: "۲۵۰ گرم", unitKind: "weight", amount: 250, toman: 1_680_000, stock: 14, isDefault: true },
      { id: "v-pib-400", sku: "SH-PIB-400", label: "۴۰۰ گرم", unitKind: "weight", amount: 400, toman: 2_490_000, stock: 7 },
    ],
  },
  {
    id: "prod-pistachios",
    categoryId: "nuts",
    sku: "SH-PIS",
    name: "مغز پسته اکبری",
    englishName: "SHAHOO Akbari Pistachio Kernels",
    subtitle: "درشت و تازه",
    homepageTitle: "مغز پسته اکبری",
    homepageSubtitle: "دست‌چین رفسنجان",
    shortDescription: "مغز پسته اکبری درشت و کم‌شکستگی.",
    fullDescription: "پسته اکبری شاهو پس از مغزکردن و سورت دستی بسته‌بندی می‌شود.",
    origin: "باغات پسته رفسنجان، رقم اکبری",
    ingredients: "۱۰۰٪ مغز پسته اکبری.",
    usageInstructions: "میان‌وعده یا آجیل. دور از رطوبت نگه دارید.",
    storageInstructions: "ظرف دربسته، جای خشک و خنک.",
    isOrganic: true,
    isBestSeller: false,
    isFeatured: false,
    catalogOrder: 10,
    visualKey: "pistachios",
    specs: [{ label: "رقم", value: "اکبری، خام" }],
    variants: [
      { id: "v-pis-250", sku: "SH-PIS-250", label: "۲۵۰ گرم", unitKind: "weight", amount: 250, toman: 1_120_000, stock: 18 },
      { id: "v-pis-500", sku: "SH-PIS-500", label: "۵۰۰ گرم", unitKind: "weight", amount: 500, toman: 2_100_000, stock: 10, isDefault: true },
    ],
  },
];

export function variantPriceIrr(variant: SeedVariant) {
  return {
    priceIrr: irr(variant.toman),
    compareAtPriceIrr: variant.compareToman ? irr(variant.compareToman) : null,
  };
}

export const seedArticles = [
  {
    id: "art-black-seed",
    categorySlug: "oils-journal",
    slug: "black-seed-oil",
    title: "همه چیز درباره روغن سیاهدانه",
    excerpt: "روش استخراج پرس سرد، نشانه‌های روغن خالص و شیوه درست نگهداری.",
    authorName: "تحریریه شاهو",
    readMinutes: 5,
    visualKey: "black-seeds",
    related: ["prod-black-seed-oil", "prod-black-seeds"],
    content: [
      "دانه سیاهدانه از دیرباز در فرهنگ غذایی ایران شناخته شده است. کیفیت روغن بیش از هر چیز به بذر اولیه و دمای روغن‌کشی وابسته است.",
      "در پرس سرد، دانه‌ها بدون حلال شیمیایی و فقط با فشار مکانیکی آرام روغن‌گیری می‌شوند.",
      "بطری تیره را پس از مصرف ببندید و در جای خنک و دور از آفتاب نگه دارید. بوی تند غیرعادی یا مزه ترشیدگی نشانه پایان عمر روغن است.",
      "این مطلب آموزشی است و جایگزین توصیه پزشک یا متخصص تغذیه نیست.",
    ].join("\n\n"),
  },
  {
    id: "art-nuts-benefits",
    categorySlug: "nuts-journal",
    slug: "raw-nuts-breakfast",
    title: "چرا مغز خام را در وعده صبحانه بگذاریم؟",
    excerpt: "گردو و بادام خام، میان‌وعده‌ای سیرکننده بدون افزودنی.",
    authorName: "تحریریه شاهو",
    readMinutes: 4,
    visualKey: "walnuts",
    related: ["prod-walnuts", "prod-raw-almonds", "prod-almond-butter"],
    content: [
      "مغزهای خام منبع چربی غیراشباع، پروتئین گیاهی و فیبر هستند. نمک زیاد و فرآوری صنعتی، سادگی آن‌ها را کم می‌کند.",
      "در شاهو مغزها از باغات تأمین و در بسته‌بندی محافظ رطوبت عرضه می‌شوند.",
    ].join("\n\n"),
  },
  {
    id: "art-herbal-infusions",
    categorySlug: "herbs-journal",
    slug: "brewing-iranian-herbs",
    title: "دم کردن اصولی گیاهان معطر ایرانی",
    excerpt: "دمای آب، زمان دم و تفاوت برگ کامل با پودر کهنه.",
    authorName: "تحریریه شاهو",
    readMinutes: 6,
    visualKey: "herbal-tea",
    related: ["prod-calming-herbal-tea"],
    content: [
      "بهارنارنج، بادرنجبویه و بابونه با آب جوش غلتان عطر لطیف‌شان را از دست می‌دهند.",
      "آب حدود ۸۰ تا ۸۵ درجه و قوری دربسته برای گل و برگ لطیف مناسب‌تر است.",
    ].join("\n\n"),
  },
  {
    id: "art-butter-stir",
    categorySlug: "butters-journal",
    slug: "why-nut-butter-separates",
    title: "چرا روغن کره مغزیجات جدا می‌شود؟",
    excerpt: "جدا شدن روغن نشانه خلوص است، نه فساد. کافی است هم بزنید.",
    authorName: "کارگاه شاهو",
    readMinutes: 3,
    visualKey: "almond-butter",
    related: ["prod-almond-butter", "prod-pistachio-butter"],
    content: [
      "کره‌های خالص شاهو امولسیفایر ندارند. به همین دلیل روغن طبیعی مغز کم‌کم روی سطح می‌آید.",
      "با قاشق تمیز هم بزنید. اگر بوی ماندگی حس کردید، محصول را مصرف نکنید و با پشتیبانی در میان بگذارید.",
    ].join("\n\n"),
  },
];

export const seedPages = [
  {
    slug: "about",
    title: "داستان شاهو",
    seoTitle: "درباره شاهو",
    seoDescription: "داستان برند شاهو و نگاه آن به خلوص محصولات طبیعی.",
    body: "برند شاهو با الهام از کوهستان شاهو و دانش کهن گیاهان ایران شکل گرفت. از روز اول هدف، عرضه روغن پرس سرد، کره مغزیجات خالص و گیاهان دست‌چین بدون افزودنی صنعتی بوده است.\n\nطبیعت بهترین کیفیت را در سادگی می‌دهد. محصولات در دسته‌های کوچک آماده می‌شوند تا تازگی از مزرعه تا خانه حفظ شود. شاهو ادعای درمان بیماری ندارد؛ خوراکی و مراقبتی سالم عرضه می‌کند.\n\nخلوص یعنی بدون افزودن روغن ارزان، شکر یا اسانس. تولید محدود می‌ماند تا روغن کهنه روی قفسه نماند. منشأ روی صفحه محصول نوشته می‌شود.",
  },
  {
    slug: "contact",
    title: "تماس با شاهو",
    seoTitle: "تماس با شاهو",
    seoDescription: "راه‌های ارتباط با فروشگاه شاهو.",
    body: "برای سفارش، موجودی و ارسال پاسخ می‌دهیم. مشاوره پزشکی ارائه نمی‌شود.",
  },
  {
    slug: "faq",
    title: "پرسش‌های پرتکرار",
    seoTitle: "سؤالات متداول شاهو",
    seoDescription: "پاسخ پرسش‌های رایج درباره محصولات، نگهداری و ارسال شاهو.",
    body: "روغن روی کره مغزیجات جدا شده است. آیا خراب است؟\nخیر. در محصول بدون امولسیفایر، جدا شدن روغن طبیعی است. پیش از مصرف هم بزنید.\n\nآیا محصولات شاهو ادعای درمانی دارند؟\nخیر. توضیحات مصرف سنتی یا خوراکی است و جایگزین توصیه پزشک نیست.\n\nچطور حجم یا وزن را انتخاب کنم؟\nدر صفحه محصول هر بسته قیمت و موجودی مستقل دارد. با تغییر گزینه، قیمت همان لحظه عوض می‌شود.\n\nارسال چگونه انجام می‌شود؟\nهزینه و روش ارسال فقط بعد از تنظیم در مدیریت فروشگاه روی صفحه تسویه دیده می‌شود. تا آن زمان مبلغ یا ارسال رایگان اعلام نمی‌شود. رهگیری خودکار وصل نیست.",
  },
  {
    slug: "shipping",
    title: "شرایط ارسال",
    seoTitle: "ارسال سفارش شاهو",
    seoDescription: "ارسال فروشگاه شاهو پس از تنظیم روش و هزینه اعلام می‌شود.",
    body: "هزینه ارسال و شرط ارسال رایگان در این نسخه از پیش تعیین نشده است. پس از اینکه مدیر فروشگاه روش و مبلغ را ذخیره کند، همان مبلغ در تسویه حساب دیده می‌شود.\n\nکد رهگیری فقط وقتی نمایش داده می‌شود که واقعاً برای سفارش ثبت شده باشد. اتصال خودکار به وب‌سرویس شرکت‌های حمل فعال نیست.",
  },
  {
    slug: "returns",
    title: "بازگشت کالا",
    seoTitle: "قوانین بازگشت کالای شاهو",
    seoDescription: "شرایط بازگشت محصولات شاهو.",
    body: "اگر بسته‌بندی نشتی داشته باشد یا کالای ارسالی با سفارش مغایرت داشته باشد، با پشتیبانی تماس بگیرید تا بررسی شود.\n\nمحصولات خوراکی بازشده به‌دلیل بهداشت فقط در صورت معیوب بودن اولیه قابل بررسی هستند. بازپرداخت پس از راه‌اندازی درگاه واقعی، از همان مسیر پرداخت ثبت خواهد شد.",
  },
  {
    slug: "privacy",
    title: "حریم خصوصی",
    seoTitle: "سیاست حریم خصوصی شاهو",
    seoDescription: "نحوه نگهداری اطلاعات مشتریان فروشگاه شاهو.",
    body: "شماره موبایل برای ورود با کد یک‌بارمصرف و پردازش سفارش نگهداری می‌شود. خود کد فقط به‌صورت هش ذخیره می‌شود.\n\nرمز مدیر، کلید درگاه و کلید پیامک در صفحات عمومی قرار نمی‌گیرند. نشست مشتری و مدیر با کوکی HttpOnly روی سرور بررسی می‌شود.",
  },
  {
    slug: "terms",
    title: "قوانین و مقررات",
    seoTitle: "قوانین فروشگاه شاهو",
    seoDescription: "شرایط استفاده از فروشگاه اینترنتی شاهو.",
    body: "ثبت سفارش پس از فعال شدن پرداخت، به معنی پذیرش قیمت محاسبه‌شده در سرور، موجودی همان لحظه و نشانی اعلام‌شده است.\n\nقیمت نمایشی در مرورگر تا قبل از تأیید سرور نهایی نیست. تصاویر بسته‌بندی واقعی پس از بارگذاری در کتابخانه رسانه جایگزین پنل‌های فعلی می‌شوند.",
  },
  {
    slug: "oil-guide",
    title: "راهنمای انتخاب روغن",
    seoTitle: "راهنمای روغن شاهو",
    seoDescription: "انتخاب روغن شاهو بر اساس مصرف، بافت و عطر.",
    body: "سه سؤال کوتاه. نتیجه بر اساس مصرف، بافت و عطر است نه نسخه پزشکی.",
  },
];
