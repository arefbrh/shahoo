export type OfferCoupon = {
  id: string;
  code: string;
  description: string;
  mode: "percent" | "amount";
  percent: number | null;
  amountToman: number | null;
  minSubtotalToman: number;
  usageLimit: number | null;
  usedCount: number;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

export type OfferShipping = {
  province?: string;
  city?: string;
  id: string;
  key: string;
  title: string;
  description: string;
  priceToman: number;
  freeOverToman: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type OfferDesk = {
  coupons: OfferCoupon[];
  methods: OfferShipping[];
};

export type OfferResult = { ok: true } | { ok: false; message: string };
