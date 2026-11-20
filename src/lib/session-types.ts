import type { OrderSummary } from "@/lib/commerce-types";

export type AccountView =
  | { authenticated: false }
  | {
      authenticated: true;
      id: string;
      mobile: string;
      fullName: string;
      firstName: string;
      lastName: string;
      gender: string | null;
      ageGroup: string | null;
      orders: OrderSummary[];
    };

export type OtpRequestResult =
  | { ok: true; sms: "sent" | "preview"; previewCode?: string; retryAfterSec: number; expiresInSec: number }
  | { ok: false; message: string; retryAfterSec?: number };

export type ActionResult = { ok: true } | { ok: false; message: string };

export type ProfileResult =
  | { ok: true; firstName: string; lastName: string; fullName: string; gender: string | null; ageGroup: string | null }
  | { ok: false; message: string };

export type AuditRow = {
  id: string;
  label: string;
  actorLabel: string;
  detail: string;
  createdAtLabel: string;
};

export type AdminSession =
  | { authenticated: false }
  | {
      authenticated: true;
      fullName: string;
      email: string | null;
      mobile: string | null;
      roles: Array<{ key: string; name: string }>;
      permissions: string[];
    };
