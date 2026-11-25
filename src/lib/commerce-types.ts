export type CartLine = {
  variantId: string;
  slug: string;
  name: string;
  imageUrl?: string;
  label: string;
  quantity: number;
  unitPriceIrr: number;
  lineTotalIrr: number;
  sellable: number;
};

export type CartSnapshot = {
  cartId?: string;
  count: number;
  lines: CartLine[];
  subtotalIrr: number;
};

export type CartMutation = {
  ok: boolean;
  message: string | null;
  cart: CartSnapshot;
};

export type ShippingChoice = {
  province?: string;
  city?: string;
  id: string;
  title: string;
  description: string;
  priceIrr: number;
  freeOverIrr: number | null;
};

export type CheckoutContext = {
  cart: CartSnapshot;
  methods: ShippingChoice[];
  paypingEnabled?: boolean;
  account: { fullName: string; mobile: string } | null;
  addresses: Array<{
    id: string;
    label: string;
    recipientName: string;
    recipientMobile: string;
    province: string;
    city: string;
    addressLine: string;
    postalCode: string;
    plaque: string;
    unit: string;
    isDefault: boolean;
  }>;
};

export type QuoteResult = {
  subtotalIrr: number;
  discountIrr: number;
  shippingIrr: number;
  totalIrr: number;
  couponApplied: boolean;
  couponMessage: string | null;
};

export type CheckoutCartExpectation = {
  cartId: string;
  lines: Array<{ variantId: string; quantity: number; unitPriceIrr: number }>;
  ownerMobile?: string | null;
};

export type PlaceOrderInput = {
  fullName: string;
  mobile: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque: string;
  unit: string;
  customerNote: string;
  shippingMethodId: string;
  couponCode: string;
  idempotencyKey: string;
  addressId?: string | null;
  cartExpectation?: CheckoutCartExpectation;
};

export type PlaceOrderResult = { ok: true; orderId: string; publicCode: string } | { ok: false; message: string; code?: "cart_changed" | "owner_changed" };

export type OrderSummary = {
  publicCode: string;
  statusLabel: string;
  paymentStatusLabel: string;
  totalIrr: number;
  itemCount: number;
  createdAtLabel: string;
  mobileMasked?: string;
};

export type OrderView = {
  publicCode: string;
  statusLabel: string;
  paymentStatusLabel: string;
  isPaid: boolean;
  isClosed: boolean;
  fullName: string;
  mobile: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque: string;
  unit: string;
  customerNote: string;
  shippingTitle: string;
  subtotalIrr: number;
  discountIrr: number;
  shippingIrr: number;
  totalIrr: number;
  couponCode: string | null;
  createdAtLabel: string;
  holdUntilLabel: string | null;
  paymentNote: string;
  trackingCode: string | null;
  carrier: string;
  shipmentNote: string;
  canRequestReturn: boolean;
  canSettleCancel: boolean;
  nextStatuses: string[];
  lines: Array<{
    id: string;
    name: string;
    label: string;
    sku: string;
    quantity: number;
    unitPriceIrr: number;
    lineTotalIrr: number;
  }>;
  events: Array<{ id: string; statusLabel: string; note: string; createdAtLabel: string }>;
  canCancel: boolean;
  canManagePayments?: boolean;
  paymentRecovery?: Array<{
    id: string;
    provider: string;
    state: string;
    amountIrr: number;
    reconciliationRequired: boolean;
    settlementError: string | null;
    verificationReady: boolean;
    settlementReady: boolean;
    createdAtLabel: string;
  }>;
  staffNote: string | null;
};
