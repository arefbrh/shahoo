const API_ORIGIN = "https://api.payping.ir";
const PAYMENT_PATH = "/v3/pay";
const MAX_PROVIDER_AMOUNT_TOMAN = 2_147_483_647;

/** SHAHOO stores integer Rial; PayPing receives integer Toman. */
export function paymentAmountToPayPingToman(amountIrr: number): number {
  if (!Number.isSafeInteger(amountIrr) || amountIrr <= 0 || amountIrr % 10 !== 0) throw new Error("payment_amount_invalid");
  const amountToman = amountIrr / 10;
  if (!Number.isSafeInteger(amountToman) || amountToman > MAX_PROVIDER_AMOUNT_TOMAN) throw new Error("payment_amount_invalid");
  return amountToman;
}

export type PayPingConfig = { apiKey: string; returnUrl: string };
export type PayPingIntent = { paymentCode: string; url: string; amountToman: number };
export type PayPingVerified = { amount: number; paymentRefId: number; clientRefId: string; code: string };

export function payPingAttemptBelongsToCustomer(attemptOrderId: string, orderId: string, orderCustomerId: string | null, customerId: string): boolean {
  return attemptOrderId.length > 0 && attemptOrderId === orderId && orderCustomerId === customerId;
}

function validReturnUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function payPingConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.PAYMENT_PROVIDER?.trim().toLowerCase() === "payping" &&
    env.PAYPING_LIVE === "1" && Boolean(env.PAYPING_API_KEY?.trim()) && validReturnUrl(env.PAYPING_RETURN_URL ?? "");
}

async function jsonRequest<T>(path: string, apiKey: string, body: unknown, fetcher: typeof fetch): Promise<{ status: number; payload: T | null }> {
  let response: Response;
  try {
    response = await fetcher(`${API_ORIGIN}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new Error(path === "/v3/pay/verify" ? "payping_verify_unknown" : "payping_network_unknown"); }
  // Verification responses that can result from an interrupted/overloaded request
  // are not proof that the payment was rejected. Keep them recoverable.
  if (path === "/v3/pay/verify" && (response.status >= 500 || response.status === 408 || response.status === 429)) {
    throw new Error("payping_verify_unknown");
  }
  let payload: T | null = null;
  try { payload = (await response.json()) as T; } catch { /* handled as malformed */ }
  return { status: response.status, payload };
}

export async function createPayPingIntent(
  config: PayPingConfig,
  input: { amountIrr: number; clientRefId: string; description: string },
  fetcher: typeof fetch = fetch,
): Promise<PayPingIntent> {
  const amountToman = paymentAmountToPayPingToman(input.amountIrr);
  if (!validReturnUrl(config.returnUrl) || !config.apiKey || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.clientRefId)) throw new Error("payping_config_invalid");
  const result = await jsonRequest<Record<string, unknown>>(PAYMENT_PATH, config.apiKey, {
    amount: amountToman, returnUrl: config.returnUrl, clientRefId: input.clientRefId, description: input.description.slice(0, 200),
  }, fetcher);
  const p = result.payload;
  if (result.status !== 200 || !p || typeof p.paymentCode !== "string" || !p.paymentCode || typeof p.url !== "string" || !Number.isSafeInteger(p.amount) || p.amount !== amountToman) {
    throw new Error("payping_intent_rejected");
  }
  let url: URL;
  try { url = new URL(p.url); } catch { throw new Error("payping_url_invalid"); }
  if (url.protocol !== "https:" || url.hostname !== "api.payping.ir" || url.username || url.password) throw new Error("payping_url_invalid");
  return { paymentCode: p.paymentCode, url: url.href, amountToman };
}

export async function verifyPayPingPayment(
  config: Pick<PayPingConfig, "apiKey">,
  input: { amountIrr: number; paymentCode: string; paymentRefId: number },
  fetcher: typeof fetch = fetch,
): Promise<PayPingVerified> {
  const amountToman = paymentAmountToPayPingToman(input.amountIrr);
  if (!config.apiKey || !input.paymentCode || !Number.isSafeInteger(input.paymentRefId) || input.paymentRefId <= 0) throw new Error("payping_callback_invalid");
  const result = await jsonRequest<Record<string, unknown>>("/v3/pay/verify", config.apiKey, {
    amount: amountToman, paymentCode: input.paymentCode, paymentRefId: input.paymentRefId,
  }, fetcher);
  const p = result.payload;
  if (result.status === 202) throw new Error("payping_verify_pending");
  // An HTTP error or malformed success body is not proof that the customer did
  // not pay. Keep it recoverable until the provider's exact rejection contract
  // is available and a response can be positively classified.
  if (result.status !== 200 && result.status !== 409) throw new Error("payping_verify_unknown");
  const conflict = p?.metaData && typeof p.metaData === "object" && p.metaData !== null ? p.metaData as Record<string, unknown> : null;
  const alreadyVerified = result.status === 409 && conflict?.code === 110 && conflict.message && typeof conflict.message === "object"
    ? conflict.message as Record<string, unknown>
    : null;
  const verified = result.status === 200 ? p : alreadyVerified;
  if (!verified || (verified.amount ?? verified.Amount) !== amountToman || (verified.code ?? verified.Code) !== input.paymentCode ||
      !Number.isSafeInteger(verified.paymentRefId ?? verified.PaymentRefId) ||
      (verified.paymentRefId ?? verified.PaymentRefId) !== input.paymentRefId ||
      typeof (verified.clientRefId ?? verified.ClientRefId) !== "string") {
    throw new Error("payping_verify_unknown");
  }
  return {
    amount: amountToman,
    paymentRefId: input.paymentRefId,
    clientRefId: String(verified.clientRefId ?? verified.ClientRefId),
    code: input.paymentCode,
  };
}
