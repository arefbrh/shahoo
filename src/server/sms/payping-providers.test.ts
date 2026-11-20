import assert from "node:assert/strict";
import test from "node:test";
import { resolveSmsProvider, smsIrProvider, smsMode } from "./providers.ts";
import { createPayPingIntent, paymentAmountToPayPingToman, payPingAttemptBelongsToCustomer, verifyPayPingPayment } from "../payments/payping.ts";

function response(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("SMS.ir Verify posts normalized mobile, template parameter and accepts only documented success", async () => {
  const provider = smsIrProvider("test-key", 456);
  const old = globalThis.fetch;
  let seen: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input, init) => { seen = { url: String(input), init }; return response(200, { status: 1, data: { messageId: 123, cost: 1 } }); }) as typeof fetch;
  try {
    await provider.sendOtp!("09123456789", "01234");
    assert.equal(seen?.url, "https://api.sms.ir/v1/send/verify");
    assert.equal(new Headers(seen?.init?.headers).get("x-api-key"), "test-key");
    assert.deepEqual(JSON.parse(String(seen?.init?.body)), { mobile: "9123456789", templateId: 456, parameters: [{ name: "Code", value: "01234" }] });
  } finally { globalThis.fetch = old; }
});

test("SMS.ir rejects invalid phone, provider status and malformed success response", async () => {
  const provider = smsIrProvider("test-key", 456);
  await assert.rejects(provider.sendOtp!("123", "12345"), /sms_invalid_input/);
  const old = globalThis.fetch;
  globalThis.fetch = (async () => response(200, { status: 10, message: "do not expose" })) as typeof fetch;
  try { await assert.rejects(provider.sendOtp!("09123456789", "12345"), /sms_rejected/); }
  finally { globalThis.fetch = old; }
});

test("PayPing converts divisible integer IRR to Toman and rejects unsafe values", () => {
  assert.equal(paymentAmountToPayPingToman(10), 1);
  assert.equal(paymentAmountToPayPingToman(1_000), 100);
  assert.equal(paymentAmountToPayPingToman(10_000), 1_000);
  assert.equal(paymentAmountToPayPingToman(1_000_000), 100_000);
  assert.equal(paymentAmountToPayPingToman(10_000_000), 1_000_000);
  for (const value of [0, -1, 1.2, 11, Number.MAX_SAFE_INTEGER, NaN]) assert.throws(() => paymentAmountToPayPingToman(value));
});

test("PayPing initiation and verification use documented v3 schemas and validate provider identity", async () => {
  const requests: Array<{ url: string; body: any }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input); const body = JSON.parse(String(init?.body)); requests.push({ url, body });
    if (url.endsWith("/v3/pay")) return response(200, { paymentCode: "code-1", url: "https://api.payping.ir/v3/pay/start/code-1", amount: 125 });
    return response(200, { amount: 125, paymentRefId: 99, clientRefId: "order-attempt-1", code: "code-1" });
  };
  const config = { apiKey: "not-real", returnUrl: "https://shop.example/api/payment/payping/callback" };
  const intent = await createPayPingIntent(config, { amountIrr: 1250, clientRefId: "order-attempt-1", description: "order" }, fakeFetch);
  assert.equal(intent.url, "https://api.payping.ir/v3/pay/start/code-1");
  const verified = await verifyPayPingPayment(config, { amountIrr: 1250, paymentCode: "code-1", paymentRefId: 99 }, fakeFetch);
  assert.equal(verified.clientRefId, "order-attempt-1");
  assert.equal(requests[0]?.body.amount, 125);
  assert.equal(requests[1]?.url, "https://api.payping.ir/v3/pay/verify");
  assert.equal(requests[1]?.body.amount, 125);
});

test("PayPing refuses untrusted redirect destinations and mismatched verify records", async () => {
  const config = { apiKey: "not-real", returnUrl: "https://shop.example/callback" };
  await assert.rejects(createPayPingIntent(config, { amountIrr: 100, clientRefId: "a1", description: "x" }, async () => response(200, { paymentCode: "x", url: "https://evil.example/", amount: 10 })));
  await assert.rejects(verifyPayPingPayment(config, { amountIrr: 100, paymentCode: "good", paymentRefId: 9 }, async () => response(200, { amount: 9, paymentRefId: 9, clientRefId: "a1", code: "good" })));
});

test("PayPing accepts only the official 409/metaData.code=110 already-verified response", async () => {
  const config = { apiKey: "not-real", returnUrl: "https://shop.example/callback" };
  const verified = await verifyPayPingPayment(config, { amountIrr: 100, paymentCode: "good", paymentRefId: 9 }, async () => response(409, {
    metaData: { code: 110, message: { Amount: 10, PaymentRefId: 9, ClientRefId: "attempt-1", Code: "good" } },
  }));
  assert.equal(verified.clientRefId, "attempt-1");
  await assert.rejects(verifyPayPingPayment(config, { amountIrr: 100, paymentCode: "good", paymentRefId: 9 }, async () => response(409, {
    metaData: { code: 111, message: { Amount: 10, PaymentRefId: 9, ClientRefId: "attempt-1", Code: "good" } },
  })));
});

test("PayPing settlement ownership requires the database order relationship", () => {
  assert.equal(payPingAttemptBelongsToCustomer("order-a", "order-a", "customer-a", "customer-a"), true);
  assert.equal(payPingAttemptBelongsToCustomer("order-a", "order-b", "customer-a", "customer-a"), false);
  assert.equal(payPingAttemptBelongsToCustomer("order-a", "order-a", "customer-b", "customer-a"), false);
});

test("SMS modes fail closed and never fall from sandbox to live", () => {
  assert.equal(smsMode({} as NodeJS.ProcessEnv), "disabled");
  assert.equal(resolveSmsProvider({ SMS_MODE: "disabled", SMS_PROVIDER: "smsir", SMS_LIVE: "1", NODE_ENV: "production", SMS_IR_API_KEY: "key", SMS_IR_OTP_TEMPLATE_ID: "456" } as NodeJS.ProcessEnv), null);
  assert.equal(resolveSmsProvider({ SMS_MODE: "sandbox", SMS_PROVIDER: "smsir", ALLOW_MOCK_SMS: "1" } as NodeJS.ProcessEnv), null);
  assert.equal(resolveSmsProvider({ SMS_MODE: "sandbox", SMS_PROVIDER: "mock", ALLOW_MOCK_SMS: "1" } as NodeJS.ProcessEnv)?.key, "mock");
  assert.equal(resolveSmsProvider({ SMS_MODE: "live", SMS_PROVIDER: "smsir", SMS_LIVE: "1", NODE_ENV: "production", SMS_IR_API_KEY: "key", SMS_IR_OTP_TEMPLATE_ID: "456" } as NodeJS.ProcessEnv)?.key, "smsir");
});

test("SMS.ir marks timeout/network failure as unknown instead of confirmed rejection", async () => {
  const provider = smsIrProvider("test-key", 456);
  const old = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network down"); }) as typeof fetch;
  try { await assert.rejects(provider.sendOtp!("09123456789", "12345"), /sms_delivery_unknown/); }
  finally { globalThis.fetch = old; }
});


test("PayPing verification pending, unauthorized, and malformed responses are never treated as confirmed rejection", async () => {
  const config = { apiKey: "not-real", returnUrl: "https://shop.example/callback" };
  const input = { amountIrr: 100, paymentCode: "good", paymentRefId: 9 };
  await assert.rejects(verifyPayPingPayment(config, input, async () => response(202, { status: "pending" })), /payping_verify_pending/);
  await assert.rejects(verifyPayPingPayment(config, input, async () => response(401, { message: "unauthorized" })), /payping_verify_unknown/);
  await assert.rejects(verifyPayPingPayment(config, input, async () => response(200, { status: "ok" })), /payping_verify_unknown/);
});
