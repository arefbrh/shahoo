import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { parseCustomerProfile } from "@/lib/customer-profile";
import { toPersianNum } from "@/lib/format";
import type { AccountView, ActionResult, OtpRequestResult, ProfileResult } from "@/lib/session-types";
import { claimGuestCart } from "../commerce/cart";
import { attachReceiptOrders, customerOrderSummaries } from "../commerce/orders";
import { customers, customerSessions, otpChallenges } from "../db/schema";
import { writeAudit } from "./audit";
import { clearSessionCookie, CUSTOMER_COOKIE, writeSessionCookie } from "./cookies";
import { hashSecret, hashSessionToken, newOtpCode, newSessionToken, shouldEchoOtp, smsIsConfigured, verifySecret } from "./crypto";
import { asTime, openDb } from "./db";
import { requireCustomer, SessionError } from "./guard";
import { maskMobile, normalizeIranMobile, normalizeOtpCode } from "./mobile";
import { reserveOtpSend, reserveOtpVerifyAttempt } from "./otp-limit";
import {
  CUSTOMER_SESSION_MS,
  LOGIN_PURPOSE,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_MS,
  OTP_TTL_MS,
} from "./policy";
import { readLoginIp } from "./request-ip";
import { readCustomer } from "./sessions";
import { deliverLoginCode } from "./sms";
import { throttleSubject } from "./throttle";

export async function loadCustomerAccount(): Promise<AccountView> {
  const db = await openDb();
  const customer = await readCustomer(db);
  if (!customer) return { authenticated: false };
  const orders = await customerOrderSummaries(db, customer.id);
  const parts = customer.fullName.trim().split(/\s+/).filter(Boolean);
  return {
    authenticated: true,
    id: customer.id,
    mobile: customer.mobile,
    fullName: customer.fullName,
    firstName: customer.firstName || parts[0] || "",
    lastName: customer.lastName || parts.slice(1).join(" "),
    gender: customer.gender,
    ageGroup: customer.ageGroup,
    orders,
  };
}

export async function requestCustomerOtp(rawMobile: string): Promise<OtpRequestResult> {
  const mobile = normalizeIranMobile(rawMobile);
  if (!mobile) return { ok: false, message: "شماره موبایل را با ۱۱ رقم و شروع ۰۹ وارد کنید." };

  const db = await openDb();
  const ip = readLoginIp();
  const decision = await reserveOtpSend(db, {
    mobileHash: throttleSubject("otp_mobile", mobile),
    ipHash: ip ? throttleSubject("otp_ip", ip) : null,
    now: Date.now(),
  });
  if (!decision.ok) {
    const wait = toPersianNum(decision.retryAfterSec);
    const message =
      decision.scope === "ip"
        ? `تعداد درخواست از این شبکه زیاد است. ${wait} ثانیه دیگر دوباره تلاش کنید.`
        : decision.reason === "cooldown"
          ? `کد قبلی هنوز معتبر است. ${wait} ثانیه دیگر دوباره درخواست کنید.`
          : `تعداد درخواست کد زیاد است. ${wait} ثانیه دیگر دوباره تلاش کنید.`;
    return { ok: false, message, retryAfterSec: decision.retryAfterSec };
  }

  const [existing] = await db.select().from(customers).where(eq(customers.mobile, mobile)).limit(1);
  if (existing && (existing.deletedAt || existing.status !== "active")) {
    return { ok: false, message: "ورود این شماره ممکن نیست." };
  }
  if (!shouldEchoOtp() && !smsIsConfigured()) {
    await writeAudit(db, {
      actorType: "anonymous",
      action: "otp.delivery_failed",
      entityType: "otp_challenge",
      metadata: { mobile: maskMobile(mobile), reason: "provider_unconfigured" },
    });
    return { ok: false, message: "ارسال پیامک هنوز وصل نشده است. تا اتصال سامانه، ورود با کد ممکن نیست." };
  }

  const code = newOtpCode();
  const challengeId = `otp-${crypto.randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx.update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpChallenges.mobile, mobile), eq(otpChallenges.purpose, LOGIN_PURPOSE), isNull(otpChallenges.consumedAt)));
    await tx.insert(otpChallenges).values({
      id: challengeId,
      mobile,
      purpose: LOGIN_PURPOSE,
      codeHash: hashSecret(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
  });

  const delivery = await deliverLoginCode(db, mobile, code);
  if (delivery === "unknown") {
    await writeAudit(db, {
      actorType: "anonymous",
      action: "otp.delivery_unknown",
      entityType: "otp_challenge",
      entityId: challengeId,
      metadata: { mobile: maskMobile(mobile), reason: "sms_delivery_unknown" },
    });
    return { ok: false, message: "وضعیت ارسال پیامک نامشخص است. فعلاً درخواست دیگری ارسال نکنید و در صورت دریافت کد از همان استفاده کنید." };
  }
  if (delivery === "failed" || delivery === "unavailable") {
    await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challengeId));
    await writeAudit(db, {
      actorType: "anonymous",
      action: "otp.delivery_failed",
      entityType: "otp_challenge",
      entityId: challengeId,
      metadata: { mobile: maskMobile(mobile), reason: delivery },
    });
    return { ok: false, message: "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید." };
  }

  await writeAudit(db, {
    actorType: "anonymous",
    action: "otp.requested",
    entityType: "otp_challenge",
    entityId: challengeId,
    metadata: { mobile: maskMobile(mobile), sms: delivery },
  });
  return {
    ok: true,
    sms: delivery === "preview" ? "preview" : "sent",
    previewCode: delivery === "preview" && shouldEchoOtp() ? code : undefined,
    retryAfterSec: OTP_RESEND_MS / 1000,
    expiresInSec: OTP_TTL_MS / 1000,
  };
}

export async function verifyCustomerOtp(rawMobile: string, rawCode: string): Promise<ActionResult> {
  const mobile = normalizeIranMobile(rawMobile);
  const code = normalizeOtpCode(rawCode);
  if (!mobile || !code) return { ok: false, message: "کد یا شماره درست نیست." };

  const db = await openDb();
  const ip = readLoginIp();
  const verificationBudget = await reserveOtpVerifyAttempt(db, {
    mobileHash: throttleSubject("otp_verify_mobile", mobile),
    ipHash: ip ? throttleSubject("otp_verify_ip", ip) : null,
    now: Date.now(),
  });
  if (!verificationBudget.ok) return { ok: false, message: `تعداد تلاش برای ورود زیاد است. ${verificationBudget.retryAfterSec} ثانیه دیگر تلاش کنید.` };
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.mobile, mobile), eq(otpChallenges.purpose, LOGIN_PURPOSE)))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);

  if (!challenge || challenge.consumedAt || asTime(challenge.expiresAt) <= Date.now()) {
    if (challenge) {
      await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challenge.id));
    }
    await writeAudit(db, {
      actorType: "anonymous",
      action: "otp.rejected",
      entityType: "otp_challenge",
      entityId: challenge?.id,
      metadata: { mobile: maskMobile(mobile), reason: "expired" },
    });
    return { ok: false, message: "کد نادرست است یا منقضی شده." };
  }

  const updated = await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt), lt(otpChallenges.attempts, OTP_MAX_ATTEMPTS)))
    .returning({ attempts: otpChallenges.attempts });
  if (updated.length === 0) {
    await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challenge.id));
    return { ok: false, message: "تلاش‌های این کد تمام شد. کد تازه بگیرید." };
  }

  const attempts = Number(updated[0]?.attempts ?? OTP_MAX_ATTEMPTS);
  if (!verifySecret(code, challenge.codeHash)) {
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challenge.id));
      return { ok: false, message: "تلاش‌های این کد تمام شد. کد تازه بگیرید." };
    }
    await writeAudit(db, {
      actorType: "anonymous",
      action: "otp.rejected",
      entityType: "otp_challenge",
      entityId: challenge.id,
      metadata: { mobile: maskMobile(mobile), reason: "mismatch" },
    });
    return { ok: false, message: "کد نادرست است یا منقضی شده." };
  }

  const consumed = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.mobile, mobile), eq(otpChallenges.purpose, LOGIN_PURPOSE), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  // Another request may have consumed the checked challenge after our attempt
  // was reserved. Consuming some other challenge is not enough to log in.
  if (!consumed.some((row) => row.id === challenge.id)) {
    return { ok: false, message: "کد نادرست است یا منقضی شده." };
  }

  const [existing] = await db.select().from(customers).where(eq(customers.mobile, mobile)).limit(1);
  if (existing && (existing.deletedAt || existing.status !== "active")) {
    return { ok: false, message: "ورود این شماره ممکن نیست." };
  }

  let customerId = existing?.id;
  if (!customerId) {
    customerId = `cust-${crypto.randomUUID()}`;
    await db.insert(customers).values({ id: customerId, mobile, fullName: "", status: "active" });
  }

  const token = newSessionToken();
  const sessionId = `csess-${crypto.randomUUID()}`;
  await db.insert(customerSessions).values({
    id: sessionId,
    customerId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MS),
  });
  writeSessionCookie(CUSTOMER_COOKIE, token, CUSTOMER_SESSION_MS / 1000);
  await claimGuestCart(db, customerId);
  await attachReceiptOrders(db, { id: customerId, mobile });
  await writeAudit(db, {
    actorType: "customer",
    actorId: customerId,
    action: "customer.login",
    entityType: "customer_session",
    entityId: sessionId,
    metadata: { mobile: maskMobile(mobile) },
  });
  return { ok: true };
}

export async function logoutCustomer(): Promise<ActionResult> {
  try {
    const { db, customer } = await requireCustomer();
    await db.update(customerSessions).set({ revokedAt: new Date() }).where(eq(customerSessions.id, customer.sessionId));
    await writeAudit(db, {
      actorType: "customer",
      actorId: customer.id,
      action: "customer.logout",
      entityType: "customer_session",
      entityId: customer.sessionId,
      metadata: { mobile: maskMobile(customer.mobile) },
    });
  } catch (error) {
    if (!(error instanceof SessionError)) throw error;
  }
  clearSessionCookie(CUSTOMER_COOKIE);
  return { ok: true };
}


export async function updateCustomerProfile(input: { firstName: string; lastName: string; gender: string | null; ageGroup: string | null }): Promise<ProfileResult> {
  const parsed = parseCustomerProfile(input);
  if (!parsed.ok) return parsed;
  const { firstName, lastName, fullName, gender, ageGroup } = parsed.value;
  try {
    const { db, customer } = await requireCustomer();
    await db.update(customers).set({ firstName, lastName, fullName, gender, ageGroup, updatedAt: new Date() }).where(eq(customers.id, customer.id));
    await writeAudit(db, {
      actorType: "customer",
      actorId: customer.id,
      action: "customer.profile_updated",
      entityType: "customer",
      entityId: customer.id,
      metadata: { fields: ["firstName", "lastName", "gender", "ageGroup"] },
    });
    return { ok: true, firstName, lastName, fullName, gender, ageGroup };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false, message: error.message };
    throw error;
  }
}
