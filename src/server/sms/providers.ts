import { mockSmsAllowed } from "../env/runtime.ts";

export interface SmsProvider {
  key: "kavenegar" | "smsir" | "mock";
  send(mobile: string, message: string): Promise<void>;
  sendOtp?(mobile: string, code: string): Promise<void>;
}

type SmsIrResponse = { status?: unknown; data?: { messageId?: unknown; cost?: unknown } };

export function smsLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.SMS_MODE?.trim().toLowerCase() === "live" && env.SMS_LIVE === "1" && Boolean(env.SMS_PROVIDER?.trim());
}

export type SmsMode = "disabled" | "sandbox" | "live";

export function smsMode(env: NodeJS.ProcessEnv = process.env): SmsMode {
  const mode = env.SMS_MODE?.trim().toLowerCase();
  return mode === "sandbox" || mode === "live" ? mode : "disabled";
}

export function resolveSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider | null {
  const key = env.SMS_PROVIDER?.trim().toLowerCase();
  const mode = smsMode(env);
  const legacyDevelopmentMock = !env.SMS_MODE?.trim() && env.NODE_ENV !== "production" && key === "mock";
  if ((mode === "sandbox" || legacyDevelopmentMock) && key === "mock") {
    if (!mockSmsAllowed(env)) return null;
    return { key: "mock", async send() {}, async sendOtp() {} };
  }
  if (mode !== "live") return null;
  if (!smsLive(env)) return null;
  if (key === "smsir" || key === "sms.ir") {
    const apiKey = env.SMS_IR_API_KEY?.trim() || env.SMS_API_KEY?.trim() || "";
    const templateId = Number(env.SMS_IR_OTP_TEMPLATE_ID);
    if (!apiKey || !Number.isSafeInteger(templateId) || templateId < 1) return null;
    return smsIrProvider(apiKey, templateId);
  }
  const apiKey = env.SMS_API_KEY?.trim() ?? "";
  if (key === "kavenegar" && apiKey) return kavenegarProvider(apiKey, env.SMS_SENDER?.trim() ?? "");
  return null;
}

export function kavenegarProvider(apiKey: string, sender: string): SmsProvider {
  return {
    key: "kavenegar",
    async send(mobile, message) {
      if (!apiKey) throw new Error("sms_unconfigured");
      const payload = new URLSearchParams({ receptor: mobile, message });
      if (sender) payload.set("sender", sender);
      let response: Response;
      try {
        response = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: payload,
          signal: AbortSignal.timeout(8000),
        });
      } catch { throw new Error("sms_delivery_unknown"); }
      if (response.status >= 500 || response.status === 408) throw new Error("sms_delivery_unknown");
      if (!response.ok) throw new Error("sms_http_failed");
      const result = (await response.json()) as { return?: { status?: number } };
      if (result.return?.status !== 200) throw new Error("sms_rejected");
    },
  };
}

export function smsIrProvider(apiKey: string, templateId: number): SmsProvider {
  const sendOtp = async (mobile: string, code: string): Promise<void> => {
    if (!/^09\d{9}$/.test(mobile) || !/^\d{5}$/.test(code)) throw new Error("sms_invalid_input");
    if (!apiKey || !Number.isSafeInteger(templateId) || templateId < 1) throw new Error("sms_unconfigured");
    let response: Response;
    try {
      response = await fetch("https://api.sms.ir/v1/send/verify", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ mobile: mobile.slice(1), templateId, parameters: [{ name: "Code", value: code }] }),
        signal: AbortSignal.timeout(8000),
      });
    } catch { throw new Error("sms_delivery_unknown"); }
    if (response.status >= 500 || response.status === 408) throw new Error("sms_delivery_unknown");
    if (!response.ok) throw new Error("sms_http_failed");
    let payload: SmsIrResponse;
    try {
      payload = (await response.json()) as SmsIrResponse;
    } catch {
      throw new Error("sms_malformed_response");
    }
    if (payload.status !== 1 || !payload.data || !Number.isSafeInteger(payload.data.messageId) || Number(payload.data.messageId) <= 0) {
      throw new Error("sms_rejected");
    }
  };
  return {
    key: "smsir",
    sendOtp,
    async send() {
      throw new Error("smsir_otp_template_required");
    },
  };
}
