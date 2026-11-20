import type { OrderSummary } from "@/lib/commerce-types";
import type { AuditRow } from "@/lib/session-types";

export type DashboardRange = "today" | "7" | "30" | "all";
export type DashboardCard = { label: string; value: string; hint?: string };
export type DashboardData = {
  denied: false;
  range: DashboardRange;
  cards: DashboardCard[];
  revenueNote: string;
  recentOrders: OrderSummary[];
  audits: AuditRow[];
  diagnostics: Array<{ id: string; message: string; createdAtLabel: string }>;
};

export type AdminOrderRow = OrderSummary & {
  shippingTitle: string;
  couponCode: string | null;
  customerName: string;
  customerMobile: string;
};
export type AdminOrderList = {
  denied: false;
  rows: AdminOrderRow[];
  page: number;
  pages: number;
  total: number;
  q: string;
  status: string;
  paymentStatus: string;
  from: string;
  to: string;
  canSearchMobile: boolean;
  error: string;
};

export type CustomerRow = {
  id: string;
  fullName: string;
  mobileMasked: string;
  status: string;
  statusLabel: string;
  orderCount: number;
  totalIrr: number;
  latestOrderAtLabel: string;
  createdAtLabel: string;
};
export type CustomerList = {
  denied: false;
  rows: CustomerRow[];
  page: number;
  pages: number;
  total: number;
  q: string;
  status: string;
  from: string;
  to: string;
  error: string;
};
export type CustomerDetail = {
  denied: false;
  id: string;
  fullName: string;
  mobile: string;
  email: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  ageGroup: string | null;
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
  status: string;
  statusLabel: string;
  createdAtLabel: string;
  orderCount: number;
  totalIrr: number;
  orders: OrderSummary[];
  canWrite: boolean;
};

export type InventoryRow = {
  variantId: string;
  productName: string;
  label: string;
  sku: string;
  unitLabel: string;
  categoryId: string;
  categoryName: string;
  onHand: number;
  reserved: number;
  sellable: number;
  threshold: number;
  low: boolean;
};
export type InventoryLogRow = {
  id: string;
  sku: string;
  productName: string;
  variantLabel: string;
  delta: number;
  reason: string;
  note: string;
  actorLabel: string;
  orderCode: string | null;
  onHandBefore: number | null;
  onHandAfter: number | null;
  reservedBefore: number | null;
  reservedAfter: number | null;
  createdAtLabel: string;
};
export type InventoryDesk = {
  denied: false;
  rows: InventoryRow[];
  logs: InventoryLogRow[];
  diagnostics: Array<{ id: string; message: string; createdAtLabel: string }>;
  canWrite: boolean;
  q: string;
  categoryId: string;
  stock: string;
  page: number;
  pages: number;
  total: number;
  logPage: number;
  logPages: number;
  logTotal: number;
  categories: Array<{ id: string; name: string }>;
};

export type ReportRow = { label: string; value: string };
export type DemographicReport = { answered: number; missing: number; categories: ReportRow[] };
export type ReportsData = {
  denied: false;
  inventory: ReportRow[];
  lowStock: InventoryRow[];
  orderStatus: ReportRow[];
  registrations: ReportRow[];
  demographics: { gender: DemographicReport; ageGroup: DemographicReport };
  coupons: ReportRow[];
  shipping: ReportRow[];
  revenueNote: string;
};
export type StaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  mobileMasked: string | null;
  status: string;
  statusLabel: string;
  roles: string[];
  self: boolean;
};
export type StaffDesk = { denied: false; admins: StaffRow[]; roleChoices: Array<{ key: string; name: string }>; canWrite: boolean };
export type DeskDenied = { denied: true; message: string };
