import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { notifications, smsTemplates } from "../db/schema";
import { resolveSmsProvider } from "../sms/providers";
import { shouldEchoOtp } from "./crypto";

export type Delivery = "sent" | "preview" | "unavailable" | "failed" | "unknown";

const STORED_BODY = "درخواست کد ورود ثبت شد. متن کد ذخیره نشده است.";

export async function deliverLoginCode(db: AppDatabase, mobile: string, code: string): Promise<Delivery> {
  if (shouldEchoOtp()) {
    await storeNotice(db, mobile, "held", null);
    return "preview";
  }
  const provider = resolveSmsProvider();
  if (!provider) {
    await storeNotice(db, mobile, "held", "provider_unconfigured");
    return "unavailable";
  }
  try {
    if (provider.key === "smsir") {
      if (!provider.sendOtp) throw new Error("smsir_template_unavailable");
      await provider.sendOtp(mobile, code);
      await storeNotice(db, mobile, "sent", null);
      return "sent";
    }
    const [template] = await db.select().from(smsTemplates).where(eq(smsTemplates.key, "otp")).limit(1);
    const rendered = (template?.body ?? "کد ورود شاهو: {code}").replaceAll("{code}", code);
    await provider.send(mobile, rendered);
    await storeNotice(db, mobile, "sent", null);
    return "sent";
  } catch (error) {
    const unknown = error instanceof Error && error.message === "sms_delivery_unknown";
    await storeNotice(db, mobile, unknown ? "unknown" : "failed", unknown ? "sms_delivery_unknown" : "sms_failed");
    return unknown ? "unknown" : "failed";
  }
}

async function storeNotice(db: AppDatabase, mobile: string, status: string, error: string | null): Promise<void> {
  const masked = mobile.length > 4 ? `${mobile.slice(0, 4)}***${mobile.slice(-2)}` : "hidden";
  await db.insert(notifications).values({
    id: `ntf-${crypto.randomUUID()}`,
    channel: "sms",
    templateKey: "otp",
    recipient: masked,
    body: STORED_BODY,
    status,
    error,
    eventKey: "otp.requested",
  });
}
