/** SHAHOO_TRUST_PROXY=1 is required before X-Forwarded-For is read. The proxy must overwrite that header. */
import { getRequest } from "@tanstack/react-start/server";
import { resolveClientIp } from "@/lib/login-throttle";

export function readLoginIp(): string | null {
  let forwarded: string | null = null;
  let socketAddress: string | null = null;
  try {
    const request = getRequest() as (Request & { ip?: string }) | undefined;
    forwarded = request?.headers.get("x-forwarded-for") ?? null;
    if (typeof request?.ip === "string") socketAddress = request.ip;
  } catch {
    return null;
  }
  return resolveClientIp({
    trustProxy: process.env.SHAHOO_TRUST_PROXY === "1",
    forwardedFor: forwarded,
    socketAddress,
  });
}
