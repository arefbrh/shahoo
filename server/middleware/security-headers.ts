import { securityHeaders } from "../../src/lib/security-headers.ts";

interface HeaderEvent {
  url: URL;
}

export default async function securityHeaderMiddleware(
  event: HeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  for (const [key, value] of Object.entries(securityHeaders(event.url.protocol === "https:"))) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}
